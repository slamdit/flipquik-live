import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { item_id, draft_id } = await req.json();

    if (!item_id || !draft_id) {
      return Response.json({ error: 'item_id and draft_id are required' }, { status: 400 });
    }

    // Fetch item, draft, and photos in parallel
    const [items, drafts, photos] = await Promise.all([
      base44.entities.Item.filter({ id: item_id }),
      base44.entities.ListingDraft.filter({ id: draft_id }),
      base44.entities.ItemPhoto.filter({ item_id })
    ]);

    const item = items[0];
    const draft = drafts[0];

    if (!item || !draft) {
      return Response.json({ error: 'Item or draft not found' }, { status: 404 });
    }

    // Sort photos: cover first, then by sort_order
    const sortedPhotos = photos.sort((a, b) => {
      if (a.is_cover && !b.is_cover) return -1;
      if (!a.is_cover && b.is_cover) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    const photoUrls = sortedPhotos.map(p => p.processed_photo || p.original_photo).filter(Boolean);

    const imageHtml = photoUrls.length > 0
      ? photoUrls.map(url =>
          `<img src="${url}" alt="Item photo" style="width:180px;height:180px;object-fit:cover;border-radius:8px;margin:4px;" />`
        ).join('')
      : '<p style="color:#888;">No photos available</p>';

    const itemUrl = `${req.headers.get('origin') || 'https://app.base44.com'}/Inventory`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <h2 style="font-size:20px;font-weight:700;margin-bottom:4px;">📦 Listing Package</h2>
  <p style="color:#666;font-size:13px;margin-top:0;">Prepared by FlipQuik</p>

  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;" />

  <!-- Photos -->
  <div style="margin-bottom:20px;">
    <h3 style="font-size:14px;font-weight:600;color:#555;margin-bottom:8px;">PHOTOS</h3>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">${imageHtml}</div>
  </div>

  <!-- Title -->
  ${draft.title ? `
  <div style="margin-bottom:16px;">
    <h3 style="font-size:14px;font-weight:600;color:#555;margin-bottom:4px;">LISTING TITLE</h3>
    <p style="font-size:16px;font-weight:600;margin:0;">${draft.title}</p>
  </div>` : ''}

  <!-- Description -->
  ${draft.description ? `
  <div style="margin-bottom:16px;">
    <h3 style="font-size:14px;font-weight:600;color:#555;margin-bottom:4px;">DESCRIPTION</h3>
    <p style="font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${draft.description}</p>
  </div>` : ''}

  <!-- Pricing -->
  ${draft.suggested_list_price ? `
  <div style="margin-bottom:16px;background:#f8f8f8;border-radius:8px;padding:12px;">
    <h3 style="font-size:14px;font-weight:600;color:#555;margin-bottom:8px;">PRICING</h3>
    <table style="font-size:14px;width:100%;border-collapse:collapse;">
      <tr><td style="padding:3px 0;color:#666;">Suggested List Price</td><td style="font-weight:700;text-align:right;">$${draft.suggested_list_price?.toFixed(2)}</td></tr>
      ${draft.expected_sale_price ? `<tr><td style="padding:3px 0;color:#666;">Expected Sale Price</td><td style="font-weight:600;text-align:right;">$${draft.expected_sale_price?.toFixed(2)}</td></tr>` : ''}
      ${draft.estimated_profit != null ? `<tr><td style="padding:3px 0;color:#666;">Est. Profit</td><td style="font-weight:600;color:${draft.estimated_profit >= 0 ? '#16a34a' : '#dc2626'};text-align:right;">${draft.estimated_profit >= 0 ? '+' : ''}$${draft.estimated_profit?.toFixed(2)}</td></tr>` : ''}
      ${draft.roi_percent != null ? `<tr><td style="padding:3px 0;color:#666;">ROI</td><td style="font-weight:600;color:${draft.roi_percent >= 0 ? '#16a34a' : '#dc2626'};text-align:right;">${draft.roi_percent?.toFixed(1)}%</td></tr>` : ''}
    </table>
  </div>` : ''}

  <!-- Internal Notes -->
  ${item.internal_notes ? `
  <div style="margin-bottom:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;">
    <h3 style="font-size:14px;font-weight:600;color:#92400e;margin-bottom:4px;">INTERNAL NOTES</h3>
    <p style="font-size:13px;color:#78350f;margin:0;white-space:pre-wrap;">${item.internal_notes}</p>
  </div>` : ''}

  <!-- Item Details -->
  <div style="margin-bottom:20px;">
    <h3 style="font-size:14px;font-weight:600;color:#555;margin-bottom:6px;">ITEM DETAILS</h3>
    <table style="font-size:13px;color:#444;width:100%;">
      ${item.brand ? `<tr><td style="padding:2px 0;color:#888;width:40%;">Brand</td><td>${item.brand}</td></tr>` : ''}
      ${item.category ? `<tr><td style="padding:2px 0;color:#888;">Category</td><td>${item.category}</td></tr>` : ''}
      ${item.condition ? `<tr><td style="padding:2px 0;color:#888;">Condition</td><td>${item.condition}</td></tr>` : ''}
      ${item.size ? `<tr><td style="padding:2px 0;color:#888;">Size</td><td>${item.size}</td></tr>` : ''}
      ${item.color ? `<tr><td style="padding:2px 0;color:#888;">Color</td><td>${item.color}</td></tr>` : ''}
      ${item.purchase_price ? `<tr><td style="padding:2px 0;color:#888;">Cost</td><td>$${item.purchase_price?.toFixed(2)}</td></tr>` : ''}
    </table>
  </div>

  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;" />

  <p style="text-align:center;">
    <a href="${itemUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;">
      View in FlipQuik →
    </a>
  </p>
</body>
</html>`;

    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Listing Package: ${draft.title || item.item_name}`,
      body: emailBody
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});