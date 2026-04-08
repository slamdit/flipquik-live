import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Cache eBay OAuth tokens in memory (edge function instances are short-lived) */
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getEbayToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`eBay OAuth failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // expire 5 min early to be safe
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  return cachedToken!;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      throw new Error('Missing "query" in request body');
    }

    const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID');
    const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET');
    if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
      throw new Error('eBay credentials not configured');
    }

    const token = await getEbayToken(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET);

    // Search eBay sold/completed listings via Browse API
    const params = new URLSearchParams({
      q: query,
      filter: 'buyingOptions:{FIXED_PRICE},conditions:{USED}',
      sort: 'endDate',
      limit: '5',
    });

    const searchRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      throw new Error(`eBay Browse API error (${searchRes.status}): ${errText}`);
    }

    const searchData = await searchRes.json();
    const items = searchData.itemSummaries || [];

    const comps = items.map((item: Record<string, unknown>) => ({
      title: (item.title as string) || '',
      price: parseFloat((item.price as Record<string, string>)?.value || '0'),
      currency: (item.price as Record<string, string>)?.currency || 'USD',
      condition: (item.condition as string) || 'Used',
      soldDate: (item.itemEndDate as string) || null,
      itemUrl: (item.itemWebUrl as string) || '',
    }));

    return new Response(JSON.stringify({ comps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ebay-sold-comps]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
