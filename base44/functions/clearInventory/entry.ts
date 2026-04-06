import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all items for this user
    const items = await base44.entities.Item.filter({ user_id: user.id }, null, 1000);
    const itemIds = items.map(i => i.id);

    if (itemIds.length === 0) {
      return Response.json({ message: 'No items to delete', deleted: 0 });
    }

    // Delete all related records
    await Promise.all([
      // Delete photos
      base44.asServiceRole.entities.ItemPhoto.filter({ item_id: { '$in': itemIds } }, null, 1000)
        .then(photos => Promise.all(photos.map(p => base44.asServiceRole.entities.ItemPhoto.delete(p.id)))),
      // Delete storage assignments
      base44.asServiceRole.entities.ItemStorageAssignment.filter({ item_id: { '$in': itemIds } }, null, 1000)
        .then(assigns => Promise.all(assigns.map(a => base44.asServiceRole.entities.ItemStorageAssignment.delete(a.id)))),
      // Delete listing drafts
      base44.asServiceRole.entities.ListingDraft.filter({ item_id: { '$in': itemIds } }, null, 1000)
        .then(drafts => Promise.all(drafts.map(d => base44.asServiceRole.entities.ListingDraft.delete(d.id)))),
      // Delete sales
      base44.asServiceRole.entities.Sale.filter({ item_id: { '$in': itemIds } }, null, 1000)
        .then(sales => Promise.all(sales.map(s => base44.asServiceRole.entities.Sale.delete(s.id)))),
    ]);

    // Delete all items
    await Promise.all(itemIds.map(id => base44.entities.Item.delete(id)));

    return Response.json({ message: 'All inventory cleared', deleted: itemIds.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});