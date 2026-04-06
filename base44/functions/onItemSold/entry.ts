import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function delistFromEbay(base44, user, item) {
  try {
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
          scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
        }),
      });
      const data = await res.json();
      if (!data.access_token) return { success: false, reason: 'Token refresh failed' };
      accessToken = data.access_token;
    }

    const sku = item.ebay_listing_id;
    if (!sku) return { success: false, reason: 'No eBay SKU on item' };

    // Get offer for this SKU
    const offersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const offersData = await offersRes.json();
    const offerId = offersData.offers?.[0]?.offerId;
    if (!offerId) return { success: false, reason: 'No active offer found' };

    // Withdraw offer (delist)
    const withdrawRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/withdraw`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}',
    });
    return { success: withdrawRes.ok };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const payload = await req.json();

  // Support both direct invocation and entity automation payload
  const item_id = payload.item_id || payload.event?.entity_id;
  const itemData = payload.data || null;

  if (!item_id) return Response.json({ error: 'item_id required' }, { status: 400 });

  // Fetch item
  const items = await base44.asServiceRole.entities.Item.filter({ id: item_id });
  const item = items[0];
  if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });

  // Only proceed if item is sold
  if (item.status !== 'sold') return Response.json({ message: 'Item not sold, skipping' });

  // Fetch user for eBay token
  const users = await base44.asServiceRole.entities.User.filter({ id: item.user_id });
  const user = users[0];

  // Fetch all active marketplace listings for this item
  const listings = await base44.asServiceRole.entities.MarketplaceListing.filter({ item_id });
  const activePlatforms = listings.filter(l => l.listing_status === 'listed' || l.listing_status === 'draft_prepared');

  const results = [];

  for (const listing of activePlatforms) {
    if (listing.platform === 'ebay') {
      // Attempt direct delist
      if (user?.ebay_refresh_token) {
        const result = await delistFromEbay(base44, user, item);
        await base44.asServiceRole.entities.MarketplaceListing.update(listing.id, {
          listing_status: result.success ? 'delisted' : 'sync_error',
          last_error_message: result.success ? null : result.reason,
          last_sync_at: new Date().toISOString(),
        });
        results.push({ platform: 'ebay', action: 'direct_delist', success: result.success });
      }
    } else {
      // For assisted platforms: create a delist action if not already pending
      const existingActions = await base44.asServiceRole.entities.MarketplaceAction.filter({
        item_id,
        platform: listing.platform,
        action_type: 'delist',
        action_status: 'pending',
      });

      if (existingActions.length === 0) {
        const platformName = listing.platform.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        await base44.asServiceRole.entities.MarketplaceAction.create({
          user_id: item.user_id,
          item_id,
          marketplace_listing_id: listing.id,
          platform: listing.platform,
          action_type: 'delist',
          action_status: 'pending',
          priority: 'critical',
          action_title: `⚠️ Delist from ${platformName} — Item Sold!`,
          action_instructions: `This item was sold. You MUST remove it from ${platformName} immediately to avoid a double-sale. Open the platform and delete or mark the listing as sold.`,
          deep_link_url: listing.external_listing_url || null,
        });

        await base44.asServiceRole.entities.MarketplaceListing.update(listing.id, {
          listing_status: 'pending_delist',
        });

        results.push({ platform: listing.platform, action: 'delist_action_created', success: true });
      }
    }
  }

  // Update item distribution_status
  await base44.asServiceRole.entities.Item.update(item_id, {
    distribution_status: 'sold',
    sold_date: item.sold_date || new Date().toISOString(),
  });

  return Response.json({ success: true, results });
});