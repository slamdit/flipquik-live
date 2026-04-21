import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Verify Stripe webhook signature (HMAC-SHA256).
 * Stripe sends: t=<timestamp>,v1=<sig1>,v1=<sig2>,...
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter(p => p.startsWith('v1='))
    .map(p => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  // Reject events older than 5 minutes
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some(s => s === expectedSig);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const sigHeader = req.headers.get('stripe-signature');
    if (!sigHeader) throw new Error('Missing stripe-signature header');

    const body = await req.text();

    const isValid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const STRIPE_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID') || '';
    const STRIPE_MAX_PRICE_ID = Deno.env.get('STRIPE_MAX_PRICE_ID') || '';

    /** Determine plan tier from a Stripe subscription's price ID or metadata. */
    function resolvePlanTier(sub: Record<string, unknown>): string {
      // Check metadata first (set during checkout)
      const metaPlan = (sub.metadata as Record<string, string>)?.plan;
      if (metaPlan === 'max') return 'max';
      if (metaPlan === 'pro') return 'pro';
      // Fall back to price ID comparison
      const items = sub.items as { data?: Array<{ price?: { id?: string } }> };
      const priceId = items?.data?.[0]?.price?.id;
      if (priceId && STRIPE_MAX_PRICE_ID && priceId === STRIPE_MAX_PRICE_ID) return 'max';
      return 'pro';
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id ||
          session.metadata?.supabase_user_id ||
          (session.customer ? await getUserIdFromCustomer(serviceClient, session.customer) : null);

        console.log('[stripe-webhook] checkout.session.completed', {
          client_reference_id: session.client_reference_id,
          metadata_user_id: session.metadata?.supabase_user_id,
          customer: session.customer,
          subscription: session.subscription,
          resolved_user_id: userId,
        });

        if (userId && session.subscription) {
          // Fetch the subscription to get period end and price info
          const sub = await stripeGet(session.subscription);
          const planTier = session.metadata?.plan || resolvePlanTier(sub);
          const { error: updateError } = await serviceClient
            .from('profiles')
            .update({
              is_pro: true,
              plan_tier: planTier,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              subscription_status: 'active',
              current_period_end: new Date((sub.current_period_end as number) * 1000).toISOString(),
            })
            .eq('id', userId);

          if (updateError) {
            console.error('[stripe-webhook] profile update failed:', updateError);
          } else {
            console.log('[stripe-webhook] profile updated for user:', userId, 'plan:', planTier);
          }
        } else {
          console.warn('[stripe-webhook] checkout.session.completed: no userId or subscription', {
            userId, subscription: session.subscription,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id ||
          (await getUserIdFromCustomer(serviceClient, sub.customer));

        if (userId) {
          const isActive = ['active', 'trialing'].includes(sub.status);
          const planTier = isActive ? resolvePlanTier(sub) : 'free';
          await serviceClient
            .from('profiles')
            .update({
              is_pro: isActive,
              plan_tier: planTier,
              subscription_status: sub.status,
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id ||
          (await getUserIdFromCustomer(serviceClient, sub.customer));

        if (userId) {
          await serviceClient
            .from('profiles')
            .update({
              is_pro: false,
              plan_tier: 'free',
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              current_period_end: null,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const userId = await getUserIdFromCustomer(serviceClient, invoice.customer);

        if (userId) {
          await serviceClient
            .from('profiles')
            .update({ subscription_status: 'past_due' })
            .eq('id', userId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/** Look up Supabase user ID from a Stripe customer ID stored in profiles. */
async function getUserIdFromCustomer(
  serviceClient: ReturnType<typeof createClient>,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  return data?.id || null;
}

/** Fetch a Stripe resource by ID (e.g., subscription). */
async function stripeGet(resourceId: string): Promise<Record<string, unknown>> {
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
  const type = resourceId.startsWith('sub_') ? 'subscriptions' : 'customers';
  const res = await fetch(`https://api.stripe.com/v1/${type}/${resourceId}`, {
    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe GET ${type}/${resourceId} failed: ${err}`);
  }
  return res.json();
}
