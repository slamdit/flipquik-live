import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function refreshEbayToken(refreshToken, clientId, clientSecret) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  });
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.ebay_refresh_token) {
      return Response.json({ error: 'eBay account not connected. Please connect in Settings.' }, { status: 400 });
    }

    const clientId = Deno.env.get('eBayClientID');
    const clientSecret = Deno.env.get('eBayCertID');

    // Refresh token if expired or missing
    let accessToken = user.ebay_access_token;
    const expiry = user.ebay_token_expiry ? new Date(user.ebay_token_expiry) : null;
    if (!accessToken || !expiry || expiry <= new Date()) {
      const refreshed = await refreshEbayToken(user.ebay_refresh_token, clientId, clientSecret);
      accessToken = refreshed.accessToken;
      await base44.auth.updateMe({
        ebay_access_token: refreshed.accessToken,
        ebay_token_expiry: refreshed.expiresAt,
      });
    }

    // Fetch active listings from eBay Inventory API
    let listings = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const res = await fetch(
        `https://api.ebay.com/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      if (!res.ok) {
        return Response.json({ error: 'eBay API error', details: data }, { status: 502 });
      }
      const page = data.inventoryItems || [];
      listings = listings.concat(page);
      if (listings.length >= (data.total || 0) || page.length < limit) break;
      offset += limit;
    }

    if (listings.length === 0) {
      return Response.json({ message: 'No eBay listings found.', synced: 0, skipped: 0 });
    }

    // Load existing items to detect duplicates by ebay_listing_id
    const existingItems = await base44.asServiceRole.entities.Item.filter({ user_id: user.id });
    const existingEbayIds = new Set(existingItems.map(i => i.ebay_listing_id).filter(Boolean));

    let synced = 0;
    let skipped = 0;

    for (const listing of listings) {
      const sku = listing.sku;
      if (!sku) { skipped++; continue; }
      if (existingEbayIds.has(sku)) { skipped++; continue; }

      const product = listing.product || {};
      const offer = listing.availability?.shipToLocationAvailability || {};

      // Extract image
      const imageUrls = product.imageUrls || [];
      const primaryPhoto = imageUrls[0] || null;

      // Build item name from title or description
      const itemName = product.title || sku;

      // Extract price from aspects if available
      const aspects = product.aspects || {};
      const brand = Array.isArray(aspects.Brand) ? aspects.Brand[0] : null;
      const condition = listing.condition || null;

      // Map eBay condition to our condition values
      let mappedCondition = null;
      if (condition) {
        const c = condition.toLowerCase();
        if (c.includes('new')) mappedCondition = 'New';
        else if (c.includes('excellent') || c.includes('like_new')) mappedCondition = 'Excellent';
        else if (c.includes('good') || c.includes('very_good')) mappedCondition = 'Good';
        else if (c.includes('fair') || c.includes('acceptable')) mappedCondition = 'Fair';
        else mappedCondition = 'Good';
      }

      const description = product.description || null;

      await base44.asServiceRole.entities.Item.create({
        user_id: user.id,
        item_name: itemName,
        brand: brand,
        condition: mappedCondition,
        notes: description,
        primary_photo_url: primaryPhoto,
        status: 'listed',
        listing_platforms: ['eBay'],
        ebay_listing_id: sku,
        search_text: [itemName, brand].filter(Boolean).join(' '),
      });

      synced++;
    }

    return Response.json({
      message: `Synced ${synced} new listing${synced !== 1 ? 's' : ''} from eBay.${skipped > 0 ? ` ${skipped} already existed or skipped.` : ''}`,
      synced,
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});