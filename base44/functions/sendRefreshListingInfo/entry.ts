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
      return Response.json({ error: 'Missing item_id or draft_id' }, { status: 400 });
    }

    // Fetch item and draft details
    const item = await base44.entities.Item.get(item_id);
    const draft = await base44.entities.ListingDraft.get(draft_id);
    const photos = await base44.entities.ItemPhoto.filter({ item_id }, 'sort_order', 10);

    if (!item || !draft) {
      return Response.json({ error: 'Item or draft not found' }, { status: 404 });
    }

    // Build HTML email
    const photoHTML = photos
      .slice(0, 5)
      .map((p, i) => `<img src="${p.original_photo}" alt="Photo ${i + 1}" style="max-width: 150px; margin: 5px; border-radius: 4px;">`)
      .join('');

    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937;">Updated Listing Info for Refresh</h2>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #374151;">${item.item_name}</h3>
        ${item.brand ? `<p><strong>Brand:</strong> ${item.brand}</p>` : ''}
        ${item.category ? `<p><strong>Category:</strong> ${item.category}</p>` : ''}
        ${item.condition ? `<p><strong>Condition:</strong> ${item.condition}</p>` : ''}
        ${item.size ? `<p><strong>Size:</strong> ${item.size}</p>` : ''}
        ${item.color ? `<p><strong>Color:</strong> ${item.color}</p>` : ''}
        ${item.purchase_price ? `<p><strong>Cost:</strong> $${item.purchase_price.toFixed(2)}</p>` : ''}
        ${item.notes ? `<p><strong>Notes:</strong> ${item.notes}</p>` : ''}
      </div>

      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="margin-top: 0; color: #92400e;">AI-Generated Listing Info</h3>
        <p><strong>Title:</strong> ${draft.title || 'N/A'}</p>
        <p><strong>Suggested Price:</strong> $${draft.suggested_list_price ? draft.suggested_list_price.toFixed(2) : 'N/A'}</p>
        <p><strong>Description:</strong></p>
        <p>${draft.description ? draft.description.replace(/\n/g, '<br>') : 'N/A'}</p>
      </div>

      ${photoHTML ? `
      <div style="margin: 20px 0;">
        <p><strong>Item Photos:</strong></p>
        <div style="display: flex; flex-wrap: wrap;">
          ${photoHTML}
        </div>
      </div>
      ` : ''}

      <div style="background-color: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #312e81;"><strong>💡 Next Steps:</strong> Use this information to refresh your listings on eBay, Poshmark, Mercari, and other platforms. Update titles, descriptions, and prices to reflect current market conditions.</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">This is your refreshed listing information. Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    `;

    // Send email
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Updated Listing Info for Refresh: ${item.item_name}`,
      body: htmlBody,
      from_name: 'FlipQuik',
    });

    return Response.json({ success: true, message: 'Email sent' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});