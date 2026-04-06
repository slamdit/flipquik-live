import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EBAY_BASE = 'https://api.ebay.com';

async function refreshEbayToken(refreshToken, clientId, clientSecret) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${EBAY_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error_description || JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = Deno.env.get('eBayClientID');
    const clientSecret = Deno.env.get('eBayCertID');

    if (!user.ebay_access_token) {
      return Response.json({ error: 'eBay account not connected. Please connect in Settings.' }, { status: 400 });
    }

    // Refresh token if expired (or close to expiring)
    let accessToken = user.ebay_access_token;
    const expiresAt = user.ebay_token_expires_at ? new Date(user.ebay_token_expires_at) : null;
    if (!expiresAt || expiresAt <= new Date(Date.now() + 60000)) {
      if (!user.ebay_refresh_token) {
        return Response.json({ error: 'eBay token expired and no refresh token available. Please reconnect in Settings.' }, { status: 400 });
      }
      const tokenData = await refreshEbayToken(user.ebay_refresh_token, clientId, clientSecret);
      accessToken = tokenData.access_token;
      const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      await base44.asServiceRole.entities.User.update(user.id, {
        ebay_access_token: accessToken,
        ebay_token_expires_at: newExpiry,
      });
    }

    // Fetch fulfilled orders from eBay (last 90 days)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const ordersRes = await fetch(
      `${EBAY_BASE}/sell/fulfillment/v1/order?filter=creationdate:[${since}..],orderfulfillmentstatus:{FULFILLED}&limit=50`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    const ordersData = await ordersRes.json();
    if (!ordersRes.ok) {
      return Response.json({ error: `eBay API error: ${ordersData.errors?.[0]?.message || JSON.stringify(ordersData)}` }, { status: 400 });
    }

    const orders = ordersData.orders || [];
    if (orders.length === 0) return Response.json({ synced: 0, message: 'No fulfilled orders found.' });

    // Get existing sales to avoid duplicates
    const existingSales = await base44.asServiceRole.entities.Sale.list('-sold_date', 500);
    const existingEbayOrderIds = new Set(existingSales.map(s => s.ebay_order_id).filter(Boolean));

    // Get user's items for matching
    const userItems = await base44.asServiceRole.entities.Item.filter({ user_id: user.id }, '-created_date', 500);

    let synced = 0;
    let skipped = 0;

    for (const order of orders) {
      if (existingEbayOrderIds.has(order.orderId)) { skipped++; continue; }

      const soldDate = order.creationDate ? order.creationDate.split('T')[0] : new Date().toISOString().split('T')[0];
      const totalSoldPrice = parseFloat(order.pricingSummary?.total?.value || 0);
      const fees = parseFloat(order.totalMarketplaceFee?.value || (totalSoldPrice * 0.1325).toFixed(2));
      const shippingCost = parseFloat(order.pricingSummary?.deliveryCost?.value || 0);

      // Process each line item in the order
      for (const lineItem of (order.lineItems || [])) {
        const lineItemPrice = parseFloat(lineItem.total?.value || lineItem.lineItemCost?.value || totalSoldPrice);
        const legacyItemId = lineItem.legacyItemId;

        // Try to match an Item by item_code = legacyItemId or by title similarity
        let matchedItem = userItems.find(i => i.item_code && i.item_code === String(legacyItemId));
        if (!matchedItem) {
          matchedItem = userItems.find(i =>
            i.status !== 'sold' && i.status !== 'archived' &&
            i.item_name && lineItem.title &&
            lineItem.title.toLowerCase().includes(i.item_name.toLowerCase().substring(0, 10))
          );
        }

        let itemId;
        if (matchedItem) {
          itemId = matchedItem.id;
          // Mark item as sold
          await base44.asServiceRole.entities.Item.update(matchedItem.id, { status: 'sold' });
        } else {
          // Create a stub item from the eBay listing data
          const newItem = await base44.asServiceRole.entities.Item.create({
            user_id: user.id,
            item_name: lineItem.title || 'eBay Item',
            item_code: legacyItemId ? String(legacyItemId) : undefined,
            status: 'sold',
            notes: `Auto-imported from eBay order ${order.orderId}`,
          });
          itemId = newItem.id;
        }

        const purchasePrice = matchedItem?.purchase_price || 0;
        const netProfit = lineItemPrice - purchasePrice - fees - shippingCost;
        const roiPercent = purchasePrice > 0 ? ((netProfit / purchasePrice) * 100) : null;

        await base44.asServiceRole.entities.Sale.create({
          item_id: itemId,
          platform: 'eBay',
          sold_price: lineItemPrice,
          fees: fees,
          shipping_cost: shippingCost,
          net_profit: netProfit,
          roi_percent: roiPercent,
          sold_date: soldDate,
          ebay_order_id: order.orderId,
          notes: `eBay Order: ${order.orderId}`,
        });

        synced++;
      }
    }

    return Response.json({ synced, skipped, message: `Synced ${synced} sale(s), skipped ${skipped} duplicate(s).` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});