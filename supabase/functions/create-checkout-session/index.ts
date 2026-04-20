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
    const STRIPE_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID')!;
    const STRIPE_MAX_PRICE_ID = Deno.env.get('STRIPE_MAX_PRICE_ID') || STRIPE_PRICE_ID;

    // Ensure profile exists (handles users who signed up before the trigger)
    await serviceClient
      .from('profiles')
      .upsert({ id: user.id, is_pro: false, subscription_status: 'free' }, { onConflict: 'id', ignoreDuplicates: true });

    // Check if user already has a Stripe customer ID
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email || '',
          name: user.user_metadata?.full_name || '',
          'metadata[supabase_user_id]': user.id,
        }),
      });

      if (!customerRes.ok) {
        const err = await customerRes.text();
        throw new Error(`Failed to create Stripe customer: ${err}`);
      }

      const customer = await customerRes.json();
      customerId = customer.id;

      // Save customer ID to profiles
      await serviceClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const origin = body.origin || 'https://flipquik.com';
    const plan = body.plan === 'max' ? 'max' : 'pro';
    const priceId = plan === 'max' ? STRIPE_MAX_PRICE_ID : STRIPE_PRICE_ID;

    // Create Checkout Session
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${origin}/Dashboard?status=success`,
        cancel_url: `${origin}/Billing?status=cancel`,
        'subscription_data[metadata][supabase_user_id]': user.id,
        'subscription_data[metadata][plan]': plan,
      }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      throw new Error(`Failed to create checkout session: ${err}`);
    }

    const session = await sessionRes.json();

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-checkout-session]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
