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
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!user.ebay_refresh_token) return Response.json({ success: false, error: 'eBay account not connected. Connect in Settings first.' }, { status: 400 });

    const body = await req.json();
    const { item_id, price, quantity = 1 } = body;

    console.log('[publishToEbay] Starting publish flow');
    console.log('[publishToEbay] item_id:', item_id, '| price:', price);

    if (!item_id || !price) {
      return Response.json({ success: false, error: 'item_id and price required' }, { status: 400 });
    }

    const items = await base44.entities.Item.filter({ id: item_id });
    const item = items[0];
    if (!item) return Response.json({ success: false, error: 'Item not found' }, { status: 404 });

    const accessToken = await getAccessToken(base44, user);
    console.log('[publishToEbay] Access token present:', !!accessToken);

    // Build clean header objects from scratch — never forward inbound req.headers
    const writeHeaders = new Headers();
    writeHeaders.set('Authorization', `Bearer ${accessToken}`);
    writeHeaders.set('Content-Type', 'application/json');
    writeHeaders.set('Content-Language', 'en-US');
    writeHeaders.set('Accept', 'application/json');
    writeHeaders.set('Accept-Language', 'en-US');

    const readHeaders = new Headers();
    readHeaders.set('Authorization', `Bearer ${accessToken}`);
    readHeaders.set('Accept', 'application/json');
    readHeaders.set('Accept-Language', 'en-US');

    const maskedHeaders = {
      'Authorization': 'Bearer ***MASKED***',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
      'Accept': 'application/json',
      'Accept-Language': 'en-US',
    };
    console.log('[publishToEbay] Write headers (masked):', JSON.stringify(maskedHeaders));

    // Fetch business policies
    const policies = await fetchPolicies(readHeaders);
    console.log('[publishToEbay] Policies:', JSON.stringify(policies));

    const sku = item.ebay_listing_id || `flipquik-${item_id}`;
    const title = (item.master_title || item.item_name || '').substring(0, 80);
    const description = item.master_description || item.notes || title;

    const photos = await base44.entities.ItemPhoto.filter({ item_id }, 'sort_order', 12);
    const imageUrls = photos.map(p => p.processed_photo || p.original_photo).filter(Boolean).slice(0, 12);
    if (item.primary_photo_url && !imageUrls.includes(item.primary_photo_url)) {
      imageUrls.unshift(item.primary_photo_url);
    }

    const conditionMap = {
      'New': 'NEW',
      'Like New': 'LIKE_NEW',
      'Excellent': 'USED_EXCELLENT',
      'Good': 'USED_GOOD',
      'Fair': 'USED_ACCEPTABLE',
      'Poor': 'FOR_PARTS_OR_NOT_WORKING',
    };
    const ebayCondition = conditionMap[item.condition] || 'USED_GOOD';

    // STEP 1: Create/update inventory item
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

    const invUrl = `${EBAY_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`;
    console.log('[publishToEbay] STEP createInventoryItem | URL:', invUrl, '| body:', JSON.stringify(inventoryPayload));

    const invRes = await fetch(invUrl, {
      method: 'PUT', headers: writeHeaders, body: JSON.stringify(inventoryPayload),
    });
    const invText = await invRes.text();
    console.log('[publishToEbay] createInventoryItem response status:', invRes.status, '| body:', invText);

    if (!invRes.ok && invRes.status !== 204) {
      return Response.json({
        success: false,
        step: 'createInventoryItem',
        status: invRes.status,
        error: invText,
      }, { status: 502 });
    }

    // STEP 2: Check for existing offer (read — no Content-Language)
    const offersUrl = `${EBAY_BASE}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`;
    console.log('[publishToEbay] STEP getOffers | URL:', offersUrl);
    const offersRes = await fetch(offersUrl, { headers: readHeaders });
    const offersText = await offersRes.text();
    console.log('[publishToEbay] getOffers response status:', offersRes.status, '| body:', offersText);

    const offersData = JSON.parse(offersText);
    let offerId = offersData.offers?.[0]?.offerId;

    // STEP: Resolve leaf categoryId via eBay Taxonomy API
    const categoryQuery = [item.brand, title].filter(Boolean).join(' ');
    const taxonomyUrl = `${EBAY_BASE}/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(categoryQuery)}`;
    console.log('[publishToEbay] STEP resolveCategory | URL:', taxonomyUrl);
    const taxonomyRes = await fetch(taxonomyUrl, { headers: readHeaders });
    const taxonomyText = await taxonomyRes.text();
    console.log('[publishToEbay] resolveCategory response status:', taxonomyRes.status, '| body:', taxonomyText.substring(0, 500));

    let categoryId = null;
    if (taxonomyRes.ok) {
      const taxonomyData = JSON.parse(taxonomyText);
      const suggestions = taxonomyData.categorySuggestions || [];
      console.log('[publishToEbay] Category suggestions:', JSON.stringify(suggestions.slice(0, 3).map(s => ({ id: s.category?.categoryId, name: s.category?.categoryName }))));
      for (const suggestion of suggestions) {
        const cat = suggestion.category;
        if (cat?.categoryId) {
          categoryId = cat.categoryId;
          console.log('[publishToEbay] Chosen categoryId:', categoryId, '| name:', cat.categoryName);
          break;
        }
      }
    }

    if (!categoryId) {
      return Response.json({
        success: false,
        step: 'resolveCategory',
        error: 'No valid eBay leaf category found for this item',
      }, { status: 502 });
    }

    // STEP: Optionally fetch required aspects for the chosen category
    const aspectsUrl = `${EBAY_BASE}/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`;
    console.log('[publishToEbay] STEP getItemAspects | URL:', aspectsUrl);
    const aspectsRes = await fetch(aspectsUrl, { headers: readHeaders });
    const aspectsText = await aspectsRes.text();
    if (aspectsRes.ok) {
      const aspectsData = JSON.parse(aspectsText);
      const required = (aspectsData.aspects || []).filter(a => a.aspectConstraint?.aspectRequired).map(a => a.localizedAspectName);
      console.log('[publishToEbay] Required aspects for category', categoryId, ':', JSON.stringify(required));
    } else {
      console.log('[publishToEbay] getItemAspects failed (non-blocking):', aspectsText.substring(0, 200));
    }

    const offerPayload = {
      sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      availableQuantity: quantity,
      categoryId,
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
      // STEP 3a: Update existing offer
      const updateUrl = `${EBAY_BASE}/sell/inventory/v1/offer/${offerId}`;
      console.log('[publishToEbay] STEP updateOffer | URL:', updateUrl, '| body:', JSON.stringify(offerPayload));
      const updateRes = await fetch(updateUrl, {
        method: 'PUT', headers: writeHeaders, body: JSON.stringify(offerPayload),
      });
      const updateText = await updateRes.text();
      console.log('[publishToEbay] updateOffer response status:', updateRes.status, '| body:', updateText);
      if (!updateRes.ok) {
        return Response.json({
          success: false,
          step: 'updateOffer',
          status: updateRes.status,
          error: updateText,
        }, { status: 502 });
      }
    } else {
      // STEP 3b: Create new offer
      const createOfferUrl = `${EBAY_BASE}/sell/inventory/v1/offer`;
      console.log('[publishToEbay] STEP createOffer | URL:', createOfferUrl, '| body:', JSON.stringify(offerPayload));
      const createOfferRes = await fetch(createOfferUrl, {
        method: 'POST', headers: writeHeaders, body: JSON.stringify(offerPayload),
      });
      const createOfferText = await createOfferRes.text();
      console.log('[publishToEbay] createOffer response status:', createOfferRes.status, '| body:', createOfferText);
      if (!createOfferRes.ok) {
        return Response.json({
          success: false,
          step: 'createOffer',
          status: createOfferRes.status,
          error: createOfferText,
        }, { status: 502 });
      }
      const offerData = JSON.parse(createOfferText);
      offerId = offerData.offerId;
    }

    // STEP 4: Publish offer
    const publishUrl = `${EBAY_BASE}/sell/inventory/v1/offer/${offerId}/publish`;
    console.log('[publishToEbay] STEP publishOffer | URL:', publishUrl);
    const publishRes = await fetch(publishUrl, {
      method: 'POST', headers: writeHeaders, body: '{}',
    });
    const publishText = await publishRes.text();
    console.log('[publishToEbay] publishOffer response status:', publishRes.status, '| body:', publishText);
    if (!publishRes.ok) {
      return Response.json({
        success: false,
        step: 'publishOffer',
        status: publishRes.status,
        error: publishText,
      }, { status: 502 });
    }

    const publishData = JSON.parse(publishText);
    const listingId = publishData.listingId || sku;

    // STEP 5: Update internal records
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

    console.log('[publishToEbay] SUCCESS | sku:', sku, '| offerId:', offerId, '| listingId:', listingId);
    return Response.json({
      success: true,
      message: 'Item successfully listed on eBay',
      sku,
      offerId,
      listingId,
    });

  } catch (error) {
    console.error('[publishToEbay] Unexpected error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});