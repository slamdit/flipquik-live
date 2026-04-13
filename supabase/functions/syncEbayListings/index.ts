import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getAccessToken, ebayBaseUrl } from '../_shared/ebayAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Not authenticated');

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Get valid eBay token ─────────────────────────────────────
    const accessToken = await getAccessToken(serviceClient, user.id);

    // ── Fetch all active eBay listings from the Sell API ─────────
    // Uses the sell/inventory/v1/offer endpoint to get current offers
    const base = ebayBaseUrl();
    const offersRes = await fetch(
      `${base}/sell/inventory/v1/offer?limit=200`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!offersRes.ok) {
      const errText = await offersRes.text();
      throw new Error(`Failed to fetch eBay offers (${offersRes.status}): ${errText}`);
    }

    const offersData = await offersRes.json() as {
      total: number;
      offers: {
        offerId: string;
        sku: string;
        listing?: { listingId: string };
        status: string;
        pricingSummary?: { price?: { value: string } };
        availableQuantity?: number;
      }[];
    };

    const ebayOffers = offersData.offers || [];

    // ── Also check recent sold orders via fulfillment API ────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ordersFilter = encodeURIComponent(
      `creationdate:[${thirtyDaysAgo.toISOString()}..${now.toISOString()}]`
    );

    const ordersRes = await fetch(
      `${base}/sell/fulfillment/v1/order?filter=${ordersFilter}&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let soldSkus: Set<string> = new Set();
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json() as {
        orders: {
          lineItems: { sku: string; legacyItemId: string }[];
          orderFulfillmentStatus: string;
        }[];
      };

      for (const order of (ordersData.orders || [])) {
        for (const lineItem of (order.lineItems || [])) {
          if (lineItem.sku) soldSkus.add(lineItem.sku);
        }
      }
    }

    // ── Load existing FlipQuik marketplace_listings for eBay ─────
    const { data: localListings } = await serviceClient
      .from('marketplace_listings')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'ebay');

    const localBySku = new Map(
      (localListings || []).map((l: { sku: string }) => [l.sku, l])
    );

    // ── Reconcile ────────────────────────────────────────────────
    let synced = 0;
    let newlyListed = 0;
    let sold = 0;
    let ended = 0;

    for (const offer of ebayOffers) {
      const sku = offer.sku;
      const local = localBySku.get(sku) as { id: string; listing_status: string } | undefined;
      const ebayPrice = offer.pricingSummary?.price?.value
        ? parseFloat(offer.pricingSummary.price.value)
        : null;

      const isSold = soldSkus.has(sku);
      const isEnded = offer.status === 'ENDED';

      if (local) {
        // Update existing record
        const newStatus = isSold ? 'sold' : isEnded ? 'delisted' : 'listed';
        const updates: Record<string, unknown> = {
          listing_status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (ebayPrice !== null) updates.platform_price = ebayPrice;
        if (offer.listing?.listingId) {
          updates.platform_listing_id = offer.listing.listingId;
          updates.external_listing_url = `https://www.ebay.com/itm/${offer.listing.listingId}`;
        }

        await serviceClient
          .from('marketplace_listings')
          .update(updates)
          .eq('id', local.id);

        if (isSold && local.listing_status !== 'sold') sold++;
        if (isEnded && !isSold && local.listing_status !== 'delisted') ended++;
        synced++;
      } else {
        // New listing found on eBay not tracked locally — create a record
        // (This covers items listed directly on eBay outside FlipQuik)
        const listingId = offer.listing?.listingId;
        await serviceClient
          .from('marketplace_listings')
          .insert({
            user_id: user.id,
            platform: 'ebay',
            sku,
            platform_listing_id: listingId || null,
            external_listing_url: listingId ? `https://www.ebay.com/itm/${listingId}` : null,
            platform_price: ebayPrice,
            listing_status: isSold ? 'sold' : isEnded ? 'delisted' : 'listed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        newlyListed++;
        synced++;
      }
    }

    // ── Mark any local listings not found on eBay as ended ───────
    const ebaySkus = new Set(ebayOffers.map(o => o.sku));
    for (const [sku, local] of localBySku.entries()) {
      const typedLocal = local as { id: string; listing_status: string };
      if (!ebaySkus.has(sku) && typedLocal.listing_status === 'listed') {
        await serviceClient
          .from('marketplace_listings')
          .update({
            listing_status: 'delisted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', typedLocal.id);
        ended++;
      }
    }

    // ── Also update any items whose eBay listing sold ────────────
    if (sold > 0) {
      const soldListings = (localListings || []).filter(
        (l: { sku: string }) => soldSkus.has(l.sku)
      ) as { item_id: string }[];

      for (const sl of soldListings) {
        if (sl.item_id) {
          await serviceClient
            .from('items')
            .update({ status: 'flipped', updated_at: new Date().toISOString() })
            .eq('id', sl.item_id);
        }
      }
    }

    const message = [
      `Synced ${synced} eBay listing${synced !== 1 ? 's' : ''}`,
      sold > 0 ? `${sold} sold` : null,
      ended > 0 ? `${ended} ended` : null,
      newlyListed > 0 ? `${newlyListed} new` : null,
    ].filter(Boolean).join(', ');

    return new Response(JSON.stringify({
      success: true,
      message,
      synced,
      sold,
      ended,
      newlyListed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[syncEbayListings]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
