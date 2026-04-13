import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Exchange an eBay authorization code for access + refresh tokens,
 * then store them in the marketplace_accounts table.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Verify the user is authenticated ──────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Not authenticated');

    // ── Get the authorization code from the request body ─────────
    const { code } = await req.json();
    if (!code) throw new Error('No authorization code provided');

    // ── Exchange code for tokens ─────────────────────────────────
    const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID')!;
    const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET')!;
    const EBAY_REDIRECT_URI = Deno.env.get('EBAY_REDIRECT_URI')!;
    const EBAY_ENVIRONMENT = Deno.env.get('EBAY_ENVIRONMENT') || 'production';

    const tokenUrl = EBAY_ENVIRONMENT === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    const basicAuth = btoa(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`);

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: EBAY_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`eBay token exchange failed (${tokenRes.status}): ${errText}`);
    }

    const tokenData = await tokenRes.json();

    /*
     * tokenData contains:
     *   access_token, expires_in (seconds), refresh_token,
     *   refresh_token_expires_in, token_type
     */

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString();

    // ── Use service role client to write tokens to marketplace_accounts ──
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if an eBay account record already exists for this user
    const { data: existing } = await serviceClient
      .from('marketplace_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', 'ebay')
      .maybeSingle();

    const accountPayload = {
      user_id: user.id,
      platform: 'ebay',
      is_connected: true,
      oauth_status: 'connected',
      access_token_encrypted: accessToken,
      refresh_token_encrypted: refreshToken,
      token_expires_at: expiresAt,
      refresh_token_expires_at: refreshExpiresAt,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await serviceClient
        .from('marketplace_accounts')
        .update(accountPayload)
        .eq('id', existing.id);
    } else {
      await serviceClient
        .from('marketplace_accounts')
        .insert({ ...accountPayload, created_at: new Date().toISOString() });
    }

    // ── Flag in user_metadata so the Settings page knows eBay is connected ──
    await serviceClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ebay_connected: true,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ebayAuthCallback]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
