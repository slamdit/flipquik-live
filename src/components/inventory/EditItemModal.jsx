import React, { useState, useEffect } from 'react';
import ItemPhotoManager from '@/components/inventory/ItemPhotoManager';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Sparkles, Send, Share2, ShoppingCart } from 'lucide-react';
import EbayListButton from '@/components/inventory/EbayListButton';
import { toast } from 'sonner';

const PLATFORMS = ['eBay', 'Poshmark', 'Mercari', 'Facebook Marketplace', 'OfferUp', 'Depop', 'ThredUp'];

export default function EditItemModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    item_name: item.item_name || '',
    brand: item.brand || '',
    category: item.category || '',
    condition: item.condition || '',
    size: item.size || '',
    color: item.color || '',
    purchase_price: item.purchase_price ?? '',
    purchase_location: item.purchase_location || '',
    purchase_date: item.purchase_date || '',
    notes: item.notes || '',
    internal_notes: item.internal_notes || '',
  });
  const [platforms, setPlatforms] = useState(item.listing_platforms || []);
  const [customPlatform, setCustomPlatform] = useState('');
  const [saving, setSaving] = useState(false);

  // Listing draft state
  const [listingDraft, setListingDraft] = useState(null);
  const [aiTitle, setAiTitle] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiPrice, setAiPrice] = useState('');
  const [aiCondition, setAiCondition] = useState('');
  const [aiSize, setAiSize] = useState('');
  const [aiColor, setAiColor] = useState('');
  const [aiTips, setAiTips] = useState([]);
  const [aiConfidence, setAiConfidence] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [photos, setPhotos] = useState([]);

  // Fetch listing draft and photos on mount
  useEffect(() => {
    const fetchDraftAndPhotos = async () => {
      try {
        const drafts = await base44.entities.ListingDraft.filter({ item_id: item.id }, '-updated_date', 1);
        if (drafts.length > 0) {
          setListingDraft(drafts[0]);
          setAiTitle(drafts[0].title || '');
          setAiDescription(drafts[0].description || '');
          setAiPrice(drafts[0].suggested_list_price || '');
        }
        const itemPhotos = await base44.entities.ItemPhoto.filter({ item_id: item.id }, 'sort_order', 50);
        setPhotos(itemPhotos);
      } catch (e) {
        // Silently fail
      }
    };
    fetchDraftAndPhotos();
  }, [item.id]);

  const togglePlatform = (p) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const addCustomPlatform = () => {
    const val = customPlatform.trim();
    if (val && !platforms.includes(val)) setPlatforms(prev => [...prev, val]);
    setCustomPlatform('');
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleRegenerateAI = async () => {
    if (photos.length === 0) {
      toast.error('Please add at least one photo to regenerate AI listing');
      return;
    }
    setGeneratingAI(true);
    try {
      const prompt = `You are an experienced resale seller. Generate a complete updated listing package for this item based on current market conditions.

Item Details:
- Name: ${form.item_name || 'Unknown'}
- Brand: ${form.brand || 'Not specified'}
- Category: ${form.category || 'Not specified'}
- Condition: ${form.condition || 'Not specified'}
- Size: ${form.size || 'Not specified'}
- Color: ${form.color || 'Not specified'}
- Purchase Price: ${form.purchase_price ? '$' + form.purchase_price : 'Not specified'}
- Notes: ${form.notes || 'None'}
- Has ${photos.length} photos

Generate fresh market-based recommendations:
title: max 80 chars, optimized for current market
description: 2-4 sentences, honest and compelling
condition: updated condition assessment
size: confirmed size if applicable
color: confirmed color
suggested_price: current market-based listing price
price_range_low / price_range_high: realistic range
confidence_level: "low", "medium", or "high"
reseller_tips: 2-4 tips for selling at current market prices

Return JSON only.`;

      const ai = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash',
        file_urls: photos.map(p => p.original_photo),
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            condition: { type: 'string' },
            size: { type: 'string' },
            color: { type: 'string' },
            suggested_price: { type: 'number' },
            price_range_low: { type: 'number' },
            price_range_high: { type: 'number' },
            confidence_level: { type: 'string' },
            reseller_tips: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      setAiTitle(ai.title || '');
      setAiDescription(ai.description || '');
      setAiPrice(ai.suggested_price || '');
      setAiCondition(ai.condition || '');
      setAiSize(ai.size || '');
      setAiColor(ai.color || '');
      setAiTips(ai.reseller_tips || []);
      setAiConfidence(ai.confidence_level || '');
      toast.success('AI listing regenerated!');
    } catch (err) {
      toast.error('Failed to regenerate AI listing');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm('Are you sure you want to purge this item? This action cannot be undone.')) return;
    try {
      await base44.entities.Item.delete(item.id);
      toast.success('Item purged');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to purge item');
    }
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) {
      toast.error('Item name is required');
      return;
    }
    setSaving(true);
    try {
      // Update Item
      await base44.entities.Item.update(item.id, {
        item_name: form.item_name.trim(),
        brand: form.brand.trim() || undefined,
        category: form.category.trim() || undefined,
        condition: form.condition.trim() || undefined,
        size: form.size.trim() || undefined,
        color: form.color.trim() || undefined,
        purchase_price: form.purchase_price !== '' ? parseFloat(form.purchase_price) : undefined,
        purchase_location: form.purchase_location.trim() || undefined,
        purchase_date: form.purchase_date || undefined,
        notes: form.notes.trim() || undefined,
        internal_notes: form.internal_notes.trim() || undefined,
        listing_platforms: platforms.length > 0 ? platforms : undefined,
        updated_at: new Date().toISOString(),
      });

      // Update or create ListingDraft
      if (listingDraft && listingDraft.id) {
        await base44.entities.ListingDraft.update(listingDraft.id, {
          title: aiTitle.trim() || undefined,
          description: aiDescription.trim() || undefined,
          suggested_list_price: aiPrice ? parseFloat(aiPrice) : undefined,
          price_suggestion: aiPrice ? parseFloat(aiPrice) : undefined,
        });
      } else if (aiTitle) {
        await base44.entities.ListingDraft.create({
          item_id: item.id,
          title: aiTitle.trim(),
          description: aiDescription.trim(),
          suggested_list_price: aiPrice ? parseFloat(aiPrice) : undefined,
          price_suggestion: aiPrice ? parseFloat(aiPrice) : undefined,
          listing_status: 'ready',
        });
      }

      toast.success('Item updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    if (!form.item_name.trim()) {
      toast.error('Item name is required');
      return;
    }
    setSaving(true);
    try {
      // First save the item
      await base44.entities.Item.update(item.id, {
        item_name: form.item_name.trim(),
        brand: form.brand.trim() || undefined,
        category: form.category.trim() || undefined,
        condition: form.condition.trim() || undefined,
        size: form.size.trim() || undefined,
        color: form.color.trim() || undefined,
        purchase_price: form.purchase_price !== '' ? parseFloat(form.purchase_price) : undefined,
        purchase_location: form.purchase_location.trim() || undefined,
        purchase_date: form.purchase_date || undefined,
        notes: form.notes.trim() || undefined,
        internal_notes: form.internal_notes.trim() || undefined,
        listing_platforms: platforms.length > 0 ? platforms : undefined,
        updated_at: new Date().toISOString(),
      });

      // Update or create ListingDraft
      let draftId = listingDraft?.id;
      if (!draftId && aiTitle) {
        const newDraft = await base44.entities.ListingDraft.create({
          item_id: item.id,
          title: aiTitle.trim(),
          description: aiDescription.trim(),
          suggested_list_price: aiPrice ? parseFloat(aiPrice) : undefined,
          price_suggestion: aiPrice ? parseFloat(aiPrice) : undefined,
          listing_status: 'ready',
        });
        draftId = newDraft.id;
      } else if (draftId) {
        await base44.entities.ListingDraft.update(draftId, {
          title: aiTitle.trim() || undefined,
          description: aiDescription.trim() || undefined,
          suggested_list_price: aiPrice ? parseFloat(aiPrice) : undefined,
          price_suggestion: aiPrice ? parseFloat(aiPrice) : undefined,
        });
      }

      // Send email with listing info
      if (draftId) {
        await base44.functions.invoke('sendRefreshListingInfo', {
          item_id: item.id,
          draft_id: draftId,
        });
        toast.success('Item saved and listing info sent to email!');
      } else {
        toast.success('Item saved');
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save and send');
    } finally {
      setSaving(false);
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

        <div className="space-y-3">
          {/* Photos */}
          <div>
            <Label className="text-sm">Photos</Label>
            <div className="mt-1">
              <ItemPhotoManager itemId={item.id} />
            </div>
          </div>

          {/* Item Details */}
          <div>
            <Label className="text-sm">Item Name *</Label>
            <Input value={form.item_name} onChange={set('item_name')} className="mt-1 h-11" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Brand</Label>
              <Input value={form.brand} onChange={set('brand')} className="mt-1 h-11" placeholder="e.g. Nike" />
            </div>
            <div>
              <Label className="text-sm">Category</Label>
              <Input value={form.category} onChange={set('category')} className="mt-1 h-11" placeholder="e.g. Clothing" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Condition</Label>
              <Input value={form.condition} onChange={set('condition')} className="mt-1 h-11" placeholder="e.g. Good" />
            </div>
            <div>
              <Label className="text-sm">Size</Label>
              <Input value={form.size} onChange={set('size')} className="mt-1 h-11" placeholder="e.g. L" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Color</Label>
              <Input value={form.color} onChange={set('color')} className="mt-1 h-11" placeholder="e.g. Blue" />
            </div>
            <div>
              <Label className="text-sm">Purchase Price</Label>
              <Input value={form.purchase_price} onChange={set('purchase_price')} type="number" step="0.01" className="mt-1 h-11" placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Purchase Location</Label>
              <Input value={form.purchase_location} onChange={set('purchase_location')} className="mt-1 h-11" placeholder="e.g. Thrift Store" />
            </div>
            <div>
              <Label className="text-sm">Purchase Date</Label>
              <Input value={form.purchase_date} onChange={set('purchase_date')} type="date" className="mt-1 h-11" />
            </div>
          </div>

          <div>
            <Label className="text-sm">Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} className="mt-1 min-h-16" placeholder="Public-facing notes..." />
          </div>

          <div>
            <Label className="text-sm">Internal Notes</Label>
            <Textarea value={form.internal_notes} onChange={set('internal_notes')} className="mt-1 min-h-16" placeholder="Private reminders, sourcing tips..." />
          </div>

          <div>
            <Label className="text-sm">Listing Platforms</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    platforms.includes(p)
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {platforms.filter(p => !PLATFORMS.includes(p)).map(p => (
              <span key={p} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full mt-2 mr-1">
                {p}
                <button onClick={() => setPlatforms(prev => prev.filter(x => x !== p))} className="text-slate-400 hover:text-slate-700"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <div className="flex gap-2 mt-2">
              <Input
                value={customPlatform}
                onChange={e => setCustomPlatform(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomPlatform())}
                placeholder="Other platform..."
                className="h-9 text-sm flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomPlatform} className="h-9">Add</Button>
            </div>
          </div>

          {/* AI Listing Section */}
          <div className="border-t pt-4 mt-4">
            <button
              type="button"
              onClick={handleRegenerateAI}
              disabled={generatingAI || saving}
              className="flex items-center gap-2 mb-3 w-full text-left hover:opacity-70 active:opacity-50 transition-opacity disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 text-sm">AI-Generated Listing</h3>
              <span className="text-xs text-slate-400 ml-auto">{generatingAI ? 'Generating...' : 'Tap to regenerate'}</span>
            </button>

            {aiConfidence && (
              <div className={`text-xs px-2.5 py-1 rounded-full font-semibold inline-block mb-3 ${
                aiConfidence === 'high' ? 'bg-green-500 text-white' :
                aiConfidence === 'medium' ? 'bg-yellow-400 text-slate-900' :
                'bg-slate-400 text-white'
              }`}>
                {aiConfidence} confidence
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-sm">Listing Title</Label>
                <Input value={aiTitle} onChange={e => setAiTitle(e.target.value)} className="mt-1 h-11" />
              </div>

              <div>
                <Label className="text-sm">Listing Description</Label>
                <Textarea value={aiDescription} onChange={e => setAiDescription(e.target.value)} className="mt-1 min-h-20" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Suggested Price ($)</Label>
                  <Input value={aiPrice} onChange={e => setAiPrice(e.target.value)} type="number" step="0.01" className="mt-1 h-11" placeholder="0.00" />
                </div>
                <div>
                  <Label className="text-sm">Condition</Label>
                  <Input value={aiCondition} onChange={e => setAiCondition(e.target.value)} className="mt-1 h-11" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Size</Label>
                  <Input value={aiSize} onChange={e => setAiSize(e.target.value)} className="mt-1 h-11" />
                </div>
                <div>
                  <Label className="text-sm">Color</Label>
                  <Input value={aiColor} onChange={e => setAiColor(e.target.value)} className="mt-1 h-11" />
                </div>
              </div>

              {aiTips.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Reseller Tips</p>
                  <ul className="space-y-1">
                    {aiTips.map((tip, i) => (
                      <li key={i} className="text-xs text-amber-900 flex gap-1.5">
                        <span>•</span><span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-5">
          <Button
            onClick={handlePurge}
            disabled={saving || generatingAI}
            variant="destructive"
            className="w-full h-12"
          >
            Purge Item
          </Button>

          <Button
            onClick={handleRegenerateAI}
            disabled={generatingAI || saving}
            variant="outline"
            className="w-full h-12"
          >
            {generatingAI ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                Regenerating...
              </div>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Regenerate AI Info
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={onClose}>Cancel</Button>
            <Button className="h-12 bg-slate-900 hover:bg-slate-800" onClick={handleSave} disabled={saving}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
            </Button>
          </div>

          <Button
            onClick={handleSaveAndSend}
            disabled={saving || generatingAI}
            className="w-full h-12 bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </div>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1.5" />
                Save & Send to Email
              </>
            )}
          </Button>

          <div className="border-t pt-3 mt-1 space-y-2">
            <EbayListButton item={item} onListed={onSaved} />
            <a href={`/DistributeListing?item_id=${item.id}`} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="w-full h-10 text-sm border-blue-200 text-blue-700 hover:bg-blue-50">
                <Share2 className="w-4 h-4 mr-1.5" />
                Distribute to All Platforms
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}