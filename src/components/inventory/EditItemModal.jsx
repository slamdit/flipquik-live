import React, { useState, useEffect } from 'react';
import { X, Trash2, Camera, Sparkles, RefreshCw, Check, Mail, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── AI Generate Listing (same logic as FlipIt page) ─────────────
function GenerateListingInline({ itemName, brand, category, condition, notes, photos, onUse }) {
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const prompt = `You are an expert resale listing writer. Create a compelling but honest listing for this item.

Item: ${itemName || 'Unknown'}
Brand: ${brand || 'Not specified'}
Category: ${category || 'Not specified'}
Condition: ${condition || 'Not specified'}
Notes: ${notes || 'None'}

Write a short, buyer-friendly listing. No filler phrases like "must have" or "see photos".

CRITICAL — VARIATION REQUIRED: Each generation MUST start with a completely different opening sentence and emphasize entirely different selling points. Use a distinctly different tone and writing style — choose one: storytelling narrative, punchy bullet-point highlights, collector-focused detail, casual conversational, or auction-house formal. Never repeat phrases from any previous version. Make this feel genuinely fresh.

Return JSON only with exactly these two fields:
- title: max 80 characters, brand + item type + key detail
- description: 2-4 sentences, honest and specific`;

      const base64_images = (photos || []).map(p => p.base64).filter(Boolean);

      const { data, error } = await supabase.functions.invoke('quikeval', {
        body: {
          prompt,
          base64_images,
          response_json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      });

      if (error) throw error;
      setGenerated(data);
    } catch {
      toast.error('Failed to generate listing. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!generated && !loading) {
    return (
      <Button
        onClick={generate}
        variant="outline"
        className="w-full h-11 border-amber-300 text-amber-700 hover:bg-amber-50"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Generate New Listing
      </Button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-amber-400 rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Writing your listing...</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">AI Listing</p>
      <div>
        <p className="text-xs text-slate-500">Title</p>
        <p className="text-sm font-medium text-slate-900">{generated.title}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Description</p>
        <p className="text-sm text-slate-700">{generated.description}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { onUse(generated); setGenerated(null); }} className="bg-amber-500 hover:bg-amber-600 text-white">
          <Check className="w-3 h-3 mr-1" />Use This
        </Button>
        <Button size="sm" variant="outline" onClick={generate}>
          <RefreshCw className="w-3 h-3 mr-1" />Remix
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setGenerated(null)} className="text-slate-500">
          <X className="w-3 h-3 mr-1" />Dismiss
        </Button>
      </div>
    </div>
  );
}

// ── Send Listing Modal (reused pattern from FlipIt) ─────────────
function SendListingModal({ form, photos, onClose }) {
  const [copied, setCopied] = useState(false);

  const fields = [
    ['Title', form.name],
    ['Description', form.notes],
    ['Brand', form.brand],
    ['Category', form.category],
    ['Condition', form.condition],
    ['Size', form.size],
    ['Color', form.color],
    ['List Price', form.suggested_price ? `$${parseFloat(form.suggested_price).toFixed(2)}` : ''],
    ['Purchase Location', form.purchase_location],
  ].filter(([, v]) => v);

  const formattedText = fields.map(([k, v]) => `${k}: ${v}`).join('\n');
  const photoUrls = (photos || []).map(p => p.original_photo).filter(Boolean);
  const fullText = photoUrls.length > 0
    ? `${formattedText}\n\nPhotos:\n${photoUrls.join('\n')}`
    : formattedText;

  const handleEmail = () => {
    const subject = encodeURIComponent(`FlipQuik Listing: ${form.name || 'Item'}`);
    const body = encodeURIComponent(fullText);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Copy failed — try selecting the text manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Send Listing</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {photoUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photoUrls.map((url, i) => (
              <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-slate-200" />
            ))}
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed border border-slate-200">
          {fullText}
        </div>

        <div className="space-y-2">
          <Button onClick={handleEmail} size="lg" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white">
            <Mail className="w-4 h-4 mr-2" />
            Send via Email
          </Button>
          <Button onClick={handleCopy} size="lg" variant="outline" className="w-full h-12">
            {copied ? <Check className="w-4 h-4 mr-2" /> : <ClipboardCopy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
        </div>

        <Button onClick={onClose} size="lg" className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white">
          Done
        </Button>
      </div>
    </div>
  );
}

// ── Main Edit Item Modal ────────────────────────────────────────
export default function EditItemModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:              item.name || item.item_name || '',
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
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [photos,        setPhotos]        = useState(
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

  const saveItem = async () => {
    const { error } = await supabase
      .from('items')
      .update({
        name:              form.name.trim(),
        brand:             form.brand.trim()              || null,
        category:          form.category.trim()           || null,
        condition:         form.condition.trim()          || null,
        size:              form.size.trim()               || null,
        color:             form.color.trim()              || null,
        cost:              form.cost !== ''               ? parseFloat(form.cost)            : null,
        suggested_price:   form.suggested_price !== ''   ? parseFloat(form.suggested_price) : null,
        purchase_location: form.purchase_location.trim() || null,
        notes:             form.notes.trim()              || null,
        internal_notes:    form.internal_notes.trim()    || null,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) throw error;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    setSaving(true);
    try {
      await saveItem();
      toast.success('Item updated');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    setSaving(true);
    try {
      await saveItem();
      toast.success('Item saved');
      onSaved();
      setShowSendModal(true);
    } catch (err) {
      toast.error(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleUseGenerated = ({ title, description }) => {
    setForm(f => ({ ...f, name: title, notes: description }));
    toast.success('Listing applied!');
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
    <>
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

          {/* Generate New Listing — TOP */}
          <div className="mb-4">
            <GenerateListingInline
              itemName={form.name}
              brand={form.brand}
              category={form.category}
              condition={form.condition}
              notes={form.notes}
              photos={photos}
              onUse={handleUseGenerated}
            />
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

          {/* BOTTOM — Save + Save & Send side by side */}
          <div className="flex flex-col gap-2 mt-5">
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-12 bg-slate-900 hover:bg-slate-800" onClick={handleSave} disabled={saving || deleting}>
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Save'
                }
              </Button>
              <Button className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveAndSend} disabled={saving || deleting}>
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Mail className="w-4 h-4 mr-1.5" />Save &amp; Send</>
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

      {showSendModal && (
        <SendListingModal
          form={form}
          photos={photos}
          onClose={() => { setShowSendModal(false); onClose(); }}
        />
      )}
    </>
  );
}
