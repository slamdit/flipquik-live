import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // ── Build eBay OAuth consent URL ──────────────────────────────
    const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID');
    const EBAY_REDIRECT_URI = Deno.env.get('EBAY_REDIRECT_URI');
    const EBAY_ENVIRONMENT = Deno.env.get('EBAY_ENVIRONMENT') || 'production';

    if (!EBAY_CLIENT_ID || !EBAY_REDIRECT_URI) {
      throw new Error('Missing eBay configuration. Set EBAY_CLIENT_ID and EBAY_REDIRECT_URI in Supabase secrets.');
    }

    const baseUrl = EBAY_ENVIRONMENT === 'sandbox'
      ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
      : 'https://auth.ebay.com/oauth2/authorize';

    // Scopes needed for listing, inventory management, and fulfillment
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    ];

    // Encode user ID in state param so we can link the token to the right user
    const state = btoa(JSON.stringify({ user_id: user.id, ts: Date.now() }));

    const params = new URLSearchParams({
      client_id: EBAY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: EBAY_REDIRECT_URI,
      scope: scopes.join(' '),
      state,
    });

    const authUrl = `${baseUrl}?${params.toString()}`;

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generateEbayAuthUrl]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
