import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EBAY_BASE = 'https://api.ebay.com';

async function getAccessToken(base44, user) {
  const clientId = Deno.env.get('eBayClientID');
  const clientSecret = Deno.env.get('eBayCertID');
  let accessToken = user.ebay_access_token;
  const expiry = user.ebay_token_expiry ? new Date(user.ebay_token_expiry) : null;
  if (!accessToken || !expiry || expiry <= new Date()) {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.ebay_refresh_token,
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
      }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));
    accessToken = data.access_token;
    await base44.auth.updateMe({
      ebay_access_token: accessToken,
      ebay_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    });
  }
  return accessToken;
}

async function fetchPolicies(headers) {
  const [fulfillRes, paymentRes, returnRes] = await Promise.all([
    fetch(`${EBAY_BASE}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`, { headers }),
    fetch(`${EBAY_BASE}/sell/account/v1/payment_policy?marketplace_id=EBAY_US`, { headers }),
    fetch(`${EBAY_BASE}/sell/account/v1/return_policy?marketplace_id=EBAY_US`, { headers }),
  ]);
  const [fulfillData, paymentData, returnData] = await Promise.all([
    fulfillRes.json(), paymentRes.json(), returnRes.json(),
  ]);
  const fulfillmentPolicyId = fulfillData.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
  const paymentPolicyId = paymentData.paymentPolicies?.[0]?.paymentPolicyId;
  const returnPolicyId = returnData.returnPolicies?.[0]?.returnPolicyId;

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error(
      `Missing eBay business policies. ` +
      `Fulfillment: ${fulfillmentPolicyId || 'MISSING'}, ` +
      `Payment: ${paymentPolicyId || 'MISSING'}, ` +
      `Return: ${returnPolicyId || 'MISSING'}. ` +
      `Please set up business policies in your eBay Seller Hub.`
    );
  }
  return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.ebay_refresh_token) return Response.json({ error: 'eBay account not connected. Connect in Settings first.' }, { status: 400 });

    const { item_id, price, quantity = 1 } = await req.json();
    if (!item_id || !price) return Response.json({ error: 'item_id and price required' }, { status: 400 });

    const items = await base44.entities.Item.filter({ id: item_id });
    const item = items[0];
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });

    const accessToken = await getAccessToken(base44, user);
    const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Content-Language': 'en-US' };

    // Fetch real business policies
    const policies = await fetchPolicies(headers);

    const sku = item.ebay_listing_id || `flipquik-${item_id}`;
    const title = (item.master_title || item.item_name || '').substring(0, 80);
    const description = item.master_description || item.notes || title;

    // Fetch photos
    const photos = await base44.entities.ItemPhoto.filter({ item_id }, 'sort_order', 12);
    const imageUrls = photos.map(p => p.processed_photo || p.original_photo).filter(Boolean).slice(0, 12);
    if (item.primary_photo_url && !imageUrls.includes(item.primary_photo_url)) {
      imageUrls.unshift(item.primary_photo_url);
    }

    // Map condition to eBay Inventory API values
    const conditionMap = {
      'New': 'NEW',
      'Like New': 'LIKE_NEW',
      'Excellent': 'USED_EXCELLENT',
      'Good': 'USED_GOOD',
      'Fair': 'USED_ACCEPTABLE',
      'Poor': 'FOR_PARTS_OR_NOT_WORKING',
    };
    const ebayCondition = conditionMap[item.condition] || 'USED_GOOD';

    // 1. Create/update inventory item
    const inventoryPayload = {
      availability: { shipToLocationAvailability: { quantity } },
      condition: ebayCondition,
      product: {
        title,
        description,
        ...(imageUrls.length > 0 && { imageUrls }),
        ...(item.brand && { aspects: { Brand: [item.brand] } }),
      },
    };

    const invRes = await fetch(`${EBAY_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      method: 'PUT', headers, body: JSON.stringify(inventoryPayload),
    });
    if (!invRes.ok && invRes.status !== 204) {
      const err = await invRes.json();
      console.error('Inventory item error:', JSON.stringify(err));
      return Response.json({ error: 'Failed to create eBay inventory item', details: err }, { status: 502 });
    }

    // 2. Check for existing offer
    const offersRes = await fetch(`${EBAY_BASE}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`, { headers });
    const offersData = await offersRes.json();
    let offerId = offersData.offers?.[0]?.offerId;

    const offerPayload = {
      sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      availableQuantity: quantity,
      categoryId: '99',
      listingDescription: description,
      pricingSummary: {
        price: { value: parseFloat(price).toFixed(2), currency: 'USD' },
      },
      listingPolicies: {
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
        paymentPolicyId: policies.paymentPolicyId,
        returnPolicyId: policies.returnPolicyId,
      },
    };

    if (offerId) {
      const updateRes = await fetch(`${EBAY_BASE}/sell/inventory/v1/offer/${offerId}`, {
        method: 'PUT', headers, body: JSON.stringify(offerPayload),
      });
      if (!updateRes.ok) {
        const err = await updateRes.json();
        console.error('Update offer error:', JSON.stringify(err));
        return Response.json({ error: 'Failed to update eBay offer', details: err }, { status: 502 });
      }
    } else {
      const createOfferRes = await fetch(`${EBAY_BASE}/sell/inventory/v1/offer`, {
        method: 'POST', headers, body: JSON.stringify(offerPayload),
      });
      const offerData = await createOfferRes.json();
      if (!createOfferRes.ok) {
        console.error('Create offer error:', JSON.stringify(offerData));
        return Response.json({ error: 'Failed to create eBay offer', details: offerData }, { status: 502 });
      }
      offerId = offerData.offerId;
    }

    // 3. Publish offer
    const publishRes = await fetch(`${EBAY_BASE}/sell/inventory/v1/offer/${offerId}/publish`, {
      method: 'POST', headers, body: '{}',
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok) {
      console.error('Publish error:', JSON.stringify(publishData));
      return Response.json({ error: 'Failed to publish eBay listing', details: publishData }, { status: 502 });
    }

    const listingId = publishData.listingId || sku;

    // 4. Update Item + MarketplaceListing
    await base44.entities.Item.update(item_id, {
      status: 'listed',
      ebay_listing_id: sku,
      suggested_price: parseFloat(price),
    });

    const existingListings = await base44.entities.MarketplaceListing.filter({ item_id, platform: 'ebay', user_id: user.id });
    if (existingListings.length > 0) {
      await base44.entities.MarketplaceListing.update(existingListings[0].id, {
        listing_status: 'listed',
        external_listing_id: listingId,
        external_listing_url: `https://www.ebay.com/itm/${listingId}`,
        platform_price: parseFloat(price),
        publish_mode: 'direct',
        last_sync_at: new Date().toISOString(),
      });
    } else {
      await base44.entities.MarketplaceListing.create({
        user_id: user.id,
        item_id,
        platform: 'ebay',
        listing_status: 'listed',
        external_listing_id: listingId,
        external_listing_url: `https://www.ebay.com/itm/${listingId}`,
        platform_title: title,
        platform_price: parseFloat(price),
        publish_mode: 'direct',
        last_sync_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, listingId, offerId, sku });
  } catch (error) {
    console.error('listOnEbay error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});