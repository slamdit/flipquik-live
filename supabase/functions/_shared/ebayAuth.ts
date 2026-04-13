import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// All scopes needed for listing, inventory, marketing, account, and fulfillment
export const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
];

export function ebayBaseUrl(): string {
  const env = Deno.env.get('EBAY_ENVIRONMENT') || 'production';
  return env === 'sandbox'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';
}

export function ebayTokenUrl(): string {
  const env = Deno.env.get('EBAY_ENVIRONMENT') || 'production';
  return env === 'sandbox'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';
}

/**
 * Refresh the eBay access token using the stored refresh token.
 * Returns the new access token and updates the DB record.
 */
export async function refreshAccessToken(
  serviceClient: ReturnType<typeof createClient>,
  account: { id: string; refresh_token_encrypted: string }
): Promise<string> {
  const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID')!;
  const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET')!;

  const basicAuth = btoa(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`);

  const res = await fetch(ebayTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token_encrypted,
      scope: EBAY_SCOPES.join(' '),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${errText}`);
  }

  const tokenData = await res.json();
  const newAccessToken = tokenData.access_token;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await serviceClient
    .from('marketplace_accounts')
    .update({
      access_token_encrypted: newAccessToken,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  return newAccessToken;
}

/**
 * Get a valid access token — refresh if expired.
 */
export async function getAccessToken(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data: account, error } = await serviceClient
    .from('marketplace_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'ebay')
    .eq('is_connected', true)
    .maybeSingle();

  if (error || !account) {
    throw new Error('eBay account not connected. Go to Settings → Connect eBay.');
  }

  // Check if token is still valid (with 5-minute buffer)
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired && account.access_token_encrypted) {
    return account.access_token_encrypted;
  }

  // Token expired — refresh it
  if (!account.refresh_token_encrypted) {
    throw new Error('eBay refresh token missing. Please reconnect your eBay account in Settings.');
  }

  return refreshAccessToken(serviceClient, account);
}

/**
 * Make an authenticated call to the eBay REST API.
 */
export async function ebayFetch(
  accessToken: string,
  path: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${ebayBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Some eBay endpoints return 204 with no body
  if (res.status === 204) {
    return { ok: true, status: 204, data: null };
  }

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }

  return { ok: res.ok, status: res.status, data };
}
