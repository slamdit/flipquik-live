import React, { useState, useEffect } from 'react';
import { X, Trash2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function EditItemModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:              item.name || '',
    brand:             item.brand || '',
    category:          item.category || '',
    condition:         item.condition || '',
    size:              item.size || '',
    color:             item.color || '',
    cost:              item.cost ?? '',
    suggested_price:   item.suggested_price ?? '',
    purchase_location: item.purchase_location || '',
    notes:             item.notes || '',
    internal_notes:    item.internal_notes || '',
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photos,   setPhotos]   = useState(
    item.primary_photo_url ? [{ original_photo: item.primary_photo_url, is_cover: true }] : []
  );

  useEffect(() => {
    supabase
      .from('item_photos')
      .select('*')
      .eq('item_id', item.id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setPhotos(data);
      });
  }, [item.id]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({
          name:              form.name.trim(),
          brand:             form.brand.trim()             || null,
          category:          form.category.trim()          || null,
          condition:         form.condition.trim()         || null,
          size:              form.size.trim()              || null,
          color:             form.color.trim()             || null,
          cost:              form.cost !== ''              ? parseFloat(form.cost)            : null,
          suggested_price:   form.suggested_price !== ''  ? parseFloat(form.suggested_price) : null,
          purchase_location: form.purchase_location.trim() || null,
          notes:             form.notes.trim()             || null,
          internal_notes:    form.internal_notes.trim()   || null,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Item updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${form.name || 'this item'}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('items').delete().eq('id', item.id);
      if (error) throw error;
      toast.success('Item deleted');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Edit Item</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo strip */}
        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {photos.map((p, i) => (
              <div key={p.id || i} className="relative shrink-0">
                <img
                  src={p.original_photo}
                  alt=""
                  className="w-20 h-20 object-cover rounded-xl border border-slate-200"
                />
                {(p.is_cover || i === 0) && (
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900/80 text-white text-[10px] rounded-full leading-tight">
                    Cover
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 rounded-xl bg-slate-100 mb-4 text-slate-400 gap-2 text-sm">
            <Camera className="w-4 h-4" />
            No photos
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-sm">Item Name *</Label>
            <Input value={form.name} onChange={set('name')} className="mt-1 h-11" placeholder="e.g. Nike Air Max 90" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Brand</Label>
              <Input value={form.brand} onChange={set('brand')} className="mt-1 h-11" placeholder="e.g. Nike" />
            </div>
            <div>
              <Label className="text-sm">Category</Label>
              <Input value={form.category} onChange={set('category')} className="mt-1 h-11" placeholder="e.g. Shoes" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Condition</Label>
              <Input value={form.condition} onChange={set('condition')} className="mt-1 h-11" placeholder="e.g. Good" />
            </div>
            <div>
              <Label className="text-sm">Size</Label>
              <Input value={form.size} onChange={set('size')} className="mt-1 h-11" placeholder="e.g. L / 10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Color</Label>
              <Input value={form.color} onChange={set('color')} className="mt-1 h-11" placeholder="e.g. Blue" />
            </div>
            <div>
              <Label className="text-sm">Purchase Location</Label>
              <Input value={form.purchase_location} onChange={set('purchase_location')} className="mt-1 h-11" placeholder="e.g. Goodwill" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Purchase Price ($)</Label>
              <Input value={form.cost} onChange={set('cost')} type="number" step="0.01" className="mt-1 h-11" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-sm">List Price ($)</Label>
              <Input value={form.suggested_price} onChange={set('suggested_price')} type="number" step="0.01" className="mt-1 h-11" placeholder="0.00" />
            </div>
          </div>

          <div>
            <Label className="text-sm">Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} className="mt-1 min-h-16 text-sm" placeholder="Public-facing notes..." />
          </div>

          <div>
            <Label className="text-sm">Internal Notes</Label>
            <p className="text-xs text-slate-400 mt-0.5 mb-1">Private — never shown to buyers</p>
            <Textarea value={form.internal_notes} onChange={set('internal_notes')} className="min-h-16 text-sm" placeholder="Sourcing notes, reminders..." />
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-5">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button className="h-12 bg-slate-900 hover:bg-slate-800" onClick={handleSave} disabled={saving || deleting}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Save Changes'
              }
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full h-11 text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleDelete}
            disabled={saving || deleting}
          >
            {deleting
              ? <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
              : <><Trash2 className="w-4 h-4 mr-1.5" />Delete Item</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
