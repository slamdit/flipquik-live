import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getAccessToken, ebayFetch } from '../_shared/ebayAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Map FlipQuik condition to eBay condition ID ──────────────────
function mapCondition(condition: string | undefined): string {
  const c = (condition || '').toLowerCase().trim();
  if (c.includes('new') && c.includes('tag'))  return '1000';  // New with tags
  if (c.includes('like new'))                   return '1500';  // Like New
  if (c.includes('new'))                        return '1000';  // New
  if (c.includes('excellent'))                  return '2000';  // Excellent - Refurbished
  if (c.includes('very good'))                  return '2500';  // Very Good
  if (c.includes('good'))                       return '3000';  // Good
  if (c.includes('fair') || c.includes('acceptable')) return '4000'; // Acceptable
  return '3000'; // Default to "Good" — safe middle ground
}

// ── Map FlipQuik category to eBay category ID ───────────────────
// Simplified mapping — eBay has 30,000+ categories.
// For production, use the Taxonomy API or a lookup table.
function mapCategory(category: string | undefined): string {
  const c = (category || '').toLowerCase().trim();

  // Clothing & Shoes
  if (c.includes('shoe') || c.includes('sneaker'))   return '93427';
  if (c.includes('shirt') || c.includes('top'))       return '15687';
  if (c.includes('pant') || c.includes('jean'))       return '11483';
  if (c.includes('jacket') || c.includes('coat'))     return '57988';
  if (c.includes('dress'))                             return '63861';
  if (c.includes('clothing') || c.includes('apparel')) return '11450';

  // Electronics
  if (c.includes('phone'))      return '9355';
  if (c.includes('laptop'))     return '175672';
  if (c.includes('tablet'))     return '171485';
  if (c.includes('electronic')) return '293';
  if (c.includes('camera'))     return '625';
  if (c.includes('game') || c.includes('gaming')) return '139971';

  // Home & Collectibles
  if (c.includes('antique'))     return '20081';
  if (c.includes('collectible')) return '1';
  if (c.includes('art'))         return '550';
  if (c.includes('pottery') || c.includes('ceramic')) return '870';
  if (c.includes('glass'))       return '20068';
  if (c.includes('silver'))      return '20096';
  if (c.includes('jewelry'))     return '281';
  if (c.includes('watch'))       return '14324';
  if (c.includes('furniture'))   return '3197';
  if (c.includes('book'))        return '261186';
  if (c.includes('vinyl') || c.includes('record')) return '176985';
  if (c.includes('toy'))         return '220';

  // Catch-all — eBay "Everything Else" category
  return '99';
}

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

    // ── Parse request ────────────────────────────────────────────
    const { item_id, price } = await req.json();
    if (!item_id) throw new Error('item_id is required');

    // ── Load item data + photos ──────────────────────────────────
    const { data: item, error: itemError } = await serviceClient
      .from('items')
      .select('*')
      .eq('id', item_id)
      .eq('user_id', user.id)
      .single();

    if (itemError || !item) throw new Error('Item not found');

    const { data: photos } = await serviceClient
      .from('item_photos')
      .select('original_photo')
      .eq('item_id', item_id)
      .order('sort_order', { ascending: true })
      .limit(12);

    // ── Get a valid eBay access token ────────────────────────────
    const accessToken = await getAccessToken(serviceClient, user.id);

    // ── Build a unique SKU for this item ─────────────────────────
    const sku = `FQ-${item_id.substring(0, 8)}`;
    const listPrice = price ?? item.price ?? item.suggested_price ?? 0;

    // ── Step 1: Create or Replace Inventory Item ─────────────────
    const imageUrls = (photos || [])
      .map((p: { original_photo: string }) => p.original_photo)
      .filter(Boolean);

    // Also include primary_photo_url as fallback
    if (imageUrls.length === 0 && item.primary_photo_url) {
      imageUrls.push(item.primary_photo_url);
    }

    const inventoryPayload: Record<string, unknown> = {
      availability: {
        shipToLocationAvailability: {
          quantity: 1,
        },
      },
      condition: mapCondition(item.condition),
      product: {
        title: (item.name || 'Untitled Item').substring(0, 80),
        description: item.notes || item.name || 'No description provided.',
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
        aspects: {} as Record<string, string[]>,
      },
    };

    // Add product aspects where available
    const aspects = (inventoryPayload.product as Record<string, unknown>).aspects as Record<string, string[]>;
    if (item.brand) aspects['Brand'] = [item.brand];
    if (item.size) aspects['Size'] = [item.size];
    if (item.color) aspects['Color'] = [item.color];

    const invResult = await ebayFetch(
      accessToken,
      `/sell/inventory/v1/inventory_item/${sku}`,
      'PUT',
      inventoryPayload
    );

    // 200 = updated, 204 = created — both are success
    if (!invResult.ok && invResult.status !== 200 && invResult.status !== 204) {
      return new Response(JSON.stringify({
        success: false,
        step: 'create_inventory_item',
        error: invResult.data,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Step 2: Check if an offer already exists for this SKU ────
    const offersResult = await ebayFetch(
      accessToken,
      `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
      'GET'
    );

    let offerId: string | null = null;
    const offersData = offersResult.data as { total?: number; offers?: { offerId: string }[] };

    if (offersResult.ok && offersData?.total && offersData.total > 0 && offersData.offers?.[0]) {
      offerId = offersData.offers[0].offerId;
    }

    const ebayCategoryId = mapCategory(item.category);

    // ── Step 2b: Fetch the user's eBay fulfillment policy ────────
    // eBay requires at least a fulfillment (shipping) policy on offers.
    // Try to find the user's default policy; if none exists, omit it
    // and let eBay return a clear error prompting the user to set one up.
    const listingPolicies: Record<string, string> = {};

    const policiesResult = await ebayFetch(
      accessToken,
      '/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US',
      'GET'
    );

    if (policiesResult.ok) {
      const policiesData = policiesResult.data as {
        total?: number;
        fulfillmentPolicies?: { fulfillmentPolicyId: string; name: string }[];
      };
      if (policiesData?.fulfillmentPolicies?.length) {
        listingPolicies.fulfillmentPolicyId = policiesData.fulfillmentPolicies[0].fulfillmentPolicyId;
      }
    }

    // Also try to find a payment policy
    const paymentResult = await ebayFetch(
      accessToken,
      '/sell/account/v1/payment_policy?marketplace_id=EBAY_US',
      'GET'
    );
    if (paymentResult.ok) {
      const paymentData = paymentResult.data as {
        paymentPolicies?: { paymentPolicyId: string }[];
      };
      if (paymentData?.paymentPolicies?.length) {
        listingPolicies.paymentPolicyId = paymentData.paymentPolicies[0].paymentPolicyId;
      }
    }

    // Also try to find a return policy
    const returnResult = await ebayFetch(
      accessToken,
      '/sell/account/v1/return_policy?marketplace_id=EBAY_US',
      'GET'
    );
    if (returnResult.ok) {
      const returnData = returnResult.data as {
        returnPolicies?: { returnPolicyId: string }[];
      };
      if (returnData?.returnPolicies?.length) {
        listingPolicies.returnPolicyId = returnData.returnPolicies[0].returnPolicyId;
      }
    }

    // If no policies found, return a helpful error instead of letting eBay 500
    if (!listingPolicies.fulfillmentPolicyId) {
      return new Response(JSON.stringify({
        success: false,
        step: 'check_policies',
        error: 'No eBay shipping (fulfillment) policy found. Please set up business policies in eBay Seller Hub (https://www.ebay.com/sh/settings/business-policies) before listing.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const offerPayload: Record<string, unknown> = {
      sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      listingDescription: item.notes || item.name || 'See photos for details.',
      availableQuantity: 1,
      categoryId: ebayCategoryId,
      pricingSummary: {
        price: {
          value: listPrice.toFixed(2),
          currency: 'USD',
        },
      },
      listingPolicies,
    };

    // ── Step 3: Create or update the offer ───────────────────────
    let finalOfferId: string;

    if (offerId) {
      // Update existing offer
      const updateResult = await ebayFetch(
        accessToken,
        `/sell/inventory/v1/offer/${offerId}`,
        'PUT',
        offerPayload
      );

      if (!updateResult.ok) {
        return new Response(JSON.stringify({
          success: false,
          step: 'update_offer',
          error: updateResult.data,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      finalOfferId = offerId;
    } else {
      // Create new offer
      const createResult = await ebayFetch(
        accessToken,
        '/sell/inventory/v1/offer',
        'POST',
        offerPayload
      );

      if (!createResult.ok) {
        return new Response(JSON.stringify({
          success: false,
          step: 'create_offer',
          error: createResult.data,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const createData = createResult.data as { offerId: string };
      finalOfferId = createData.offerId;
    }

    // ── Step 4: Publish the offer (makes it live on eBay) ────────
    const publishResult = await ebayFetch(
      accessToken,
      `/sell/inventory/v1/offer/${finalOfferId}/publish`,
      'POST'
    );

    if (!publishResult.ok) {
      return new Response(JSON.stringify({
        success: false,
        step: 'publish_offer',
        error: publishResult.data,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const publishData = publishResult.data as { listingId?: string };
    const ebayListingId = publishData?.listingId || null;

    // ── Step 5: Save listing record in FlipQuik ──────────────────
    const ebayListingUrl = ebayListingId
      ? `https://www.ebay.com/itm/${ebayListingId}`
      : null;

    // Check if a marketplace_listing already exists
    const { data: existingListing } = await serviceClient
      .from('marketplace_listings')
      .select('id')
      .eq('item_id', item_id)
      .eq('platform', 'ebay')
      .maybeSingle();

    const listingPayload = {
      item_id,
      user_id: user.id,
      platform: 'ebay',
      platform_listing_id: ebayListingId,
      external_listing_url: ebayListingUrl,
      platform_title: item.name,
      platform_description: item.notes || '',
      platform_price: listPrice,
      listing_status: 'listed',
      sku,
      updated_at: new Date().toISOString(),
    };

    if (existingListing) {
      await serviceClient
        .from('marketplace_listings')
        .update(listingPayload)
        .eq('id', existingListing.id);
    } else {
      await serviceClient
        .from('marketplace_listings')
        .insert({ ...listingPayload, created_at: new Date().toISOString() });
    }

    // ── Update item status to 'listed' ───────────────────────────
    await serviceClient
      .from('items')
      .update({ status: 'listed', updated_at: new Date().toISOString() })
      .eq('id', item_id);

    return new Response(JSON.stringify({
      success: true,
      listingId: ebayListingId,
      listingUrl: ebayListingUrl,
      offerId: finalOfferId,
      sku,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[publishToEbay]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
