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
    // Get token from header OR body (header may be stripped by relay)
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || body.accessToken;
    if (!token) throw new Error('Not authenticated');

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid auth token');

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

    // Get user's Stripe customer ID
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      throw new Error('No Stripe customer found. Subscribe to a plan first.');
    }

    const origin = body.origin || 'https://flipquik.com';

    // Create Stripe billing portal session
    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: profile.stripe_customer_id,
        return_url: `${origin}/Billing`,
      }),
    });

    if (!portalRes.ok) {
      const err = await portalRes.text();
      throw new Error(`Failed to create portal session: ${err}`);
    }

    const session = await portalRes.json();

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-portal-session]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
