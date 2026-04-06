import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import CapturePhotoManager from '@/components/capture/CapturePhotoManager';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Sparkles, MapPin, Package, Send, X, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function QuickCaptureForm({ onSuccess, prefill, initialPhotosData = [] }) {
  const photoManagerRef = useRef(null);
  const p = prefill || {};
  const [itemSpecs, setItemSpecs] = useState(p.item_name || '');
  const [purchasePrice, setPurchasePrice] = useState(p.purchase_price || '');
  const [brand, setBrand] = useState(p.brand || '');
  const [category, setCategory] = useState(p.category || '');
  const [internalNotes, setInternalNotes] = useState(p.notes || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Listing state
  const [listing, setListing] = useState(null);
  const [location, setLocation] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  // Auto-fetch location when listing is generated
  const fetchLocation = () => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || '';
          const state = data.address?.state || '';
          setLocation([city, state].filter(Boolean).join(', '));
        } catch {
          // silently fail
        } finally {
          setLocationLoading(false);
        }
      },
      () => setLocationLoading(false)
    );
  };

  const buildItemPayload = async (status) => {
    const user = await base44.auth.me();
    const searchKeywords = [itemSpecs.trim(), brand.trim(), category.trim()].filter(Boolean).join(' ').toLowerCase();

    // Upload original full-resolution photos
    const photosToUpload = photoManagerRef.current?.getPhotosToUpload() || [];
    const uploadedPhotos = await Promise.all(
      photosToUpload.map(async (p) => {
        if (p.originalFile) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: p.originalFile });
          return { url: file_url, isCover: p.isCover };
        }
        // Already uploaded (e.g. manually added without original file)
        return { url: p.compressedUrl || p.displayUrl, isCover: p.isCover };
      })
    );

    const coverPhoto = uploadedPhotos.find(p => p.isCover) || uploadedPhotos[0];

    const item = await base44.entities.Item.create({
      user_id: user.id,
      item_name: itemSpecs.trim() || 'Quick capture item',
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
      brand: brand.trim() || undefined,
      category: category.trim() || undefined,
      internal_notes: internalNotes.trim() || undefined,
      status,
      primary_photo_url: coverPhoto?.url || undefined,
      search_text: searchKeywords,
      updated_at: new Date().toISOString(),
    });

    if (uploadedPhotos.length > 0) {
      await Promise.all(uploadedPhotos.map((p, i) =>
        base44.entities.ItemPhoto.create({ item_id: item.id, original_photo: p.url, sort_order: i, is_cover: p.isCover })
      ));
    }
    return item;
  };

  const handleSaveDraft = async () => {
    if ((photoManagerRef.current?.getPhotoCount() ?? 0) === 0) { toast.error('Please add at least one photo'); return; }
    setSaving(true);
    try {
      const item = await buildItemPayload('draft');
      await base44.entities.ListingDraft.create({ item_id: item.id, listing_status: 'incomplete' });
      toast.success('Saved to drafts!');
      onSuccess();
    } catch { toast.error('Failed to save draft'); }
    finally { setSaving(false); }
  };

  const handleCreateListing = async () => {
    if ((photoManagerRef.current?.getPhotoCount() ?? 0) === 0) { toast.error('Please add at least one photo'); return; }
    if (!purchasePrice) { toast.error('Please enter a purchase price'); return; }
    setGenerating(true);
    try {
      const prompt = `You are an experienced resale seller. Generate a complete listing package for the item below.

Item Details:
- Specs/Name: ${itemSpecs || 'Unknown'}
- Brand: ${brand || 'Not specified'}
- Category: ${category || 'Not specified'}
- Purchase Price: ${purchasePrice ? '$' + purchasePrice : 'Not specified'}
- Notes: ${internalNotes || 'None'}
- Has Photos: ${(photoManagerRef.current?.getPhotoCount() ?? 0) > 0 ? 'Yes (' + photoManagerRef.current.getPhotoCount() + ')' : 'No'}

Generate:
title: max 80 chars, brand + item type + key detail + condition if notable
description: 2-4 sentences, clear, honest, buyer-friendly. No "see photos", "must-have", or invented specs.
condition: estimated condition (Excellent / Good / Fair / Poor)
size: if determinable
color: if determinable
price_range_low / price_range_high: realistic secondhand USD range
suggested_price: single best list price
confidence_level: "low", "medium", or "high"
reseller_tips: 2-4 short practical tips

Return JSON only.`;

      const ai = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash',
        file_urls: (photoManagerRef.current?.getPhotosToUpload() || []).map(p => p.compressedUrl || p.displayUrl),
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            condition: { type: 'string' },
            size: { type: 'string' },
            color: { type: 'string' },
            price_range_low: { type: 'number' },
            price_range_high: { type: 'number' },
            suggested_price: { type: 'number' },
            confidence_level: { type: 'string' },
            reseller_tips: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      setListing({
        title: ai.title || '',
        description: ai.description || '',
        condition: ai.condition || '',
        size: ai.size || '',
        color: ai.color || '',
        price_range_low: ai.price_range_low,
        price_range_high: ai.price_range_high,
        suggested_price: ai.suggested_price,
        confidence_level: ai.confidence_level,
        reseller_tips: ai.reseller_tips || [],
      });

      fetchLocation();
    } catch { toast.error('Failed to generate listing'); }
    finally { setGenerating(false); }
  };

  const handleAddToInventory = async () => {
    setSaving(true);
    try {
      const item = await buildItemPayload('captured');
      await base44.entities.ListingDraft.create({
        item_id: item.id,
        title: listing.title,
        description: listing.description,
        price_suggestion: listing.suggested_price,
        suggested_list_price: listing.suggested_price,
        listing_status: 'ready',
        listing_notes: location ? `Location: ${location}` : undefined,
      });
      toast.success('Added to inventory!');
      onSuccess();
    } catch { toast.error('Failed to add to inventory'); }
    finally { setSaving(false); }
  };

  const handleSaveListingDraft = async () => {
    setSaving(true);
    try {
      const item = await buildItemPayload('draft');
      await base44.entities.ListingDraft.create({
        item_id: item.id,
        title: listing.title,
        description: listing.description,
        price_suggestion: listing.suggested_price,
        suggested_list_price: listing.suggested_price,
        listing_status: 'incomplete',
      });
      toast.success('Saved to draft!');
      onSuccess();
    } catch { toast.error('Failed to save draft'); }
    finally { setSaving(false); }
  };

  const handleSendPostingInfo = async () => {
    setSaving(true);
    try {
      const item = await buildItemPayload('draft');
      const draft = await base44.entities.ListingDraft.create({
        item_id: item.id,
        title: listing.title,
        description: listing.description,
        price_suggestion: listing.suggested_price,
        suggested_list_price: listing.suggested_price,
        listing_status: 'ready',
      });
      await base44.functions.invoke('sendListingPackage', { item_id: item.id, draft_id: draft.id });
      toast.success('Posting info sent to your email!');
      onSuccess();
    } catch { toast.error('Failed to send posting info'); }
    finally { setSaving(false); }
  };

  const handleSkip = () => {
    setListing(null);
  };

  // ── LISTING VIEW ──────────────────────────────────────────────
  if (listing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold text-slate-900 text-lg">AI-Generated Listing</h2>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${
            listing.confidence_level === 'high' ? 'bg-green-500 text-white' :
            listing.confidence_level === 'medium' ? 'bg-yellow-400 text-slate-900' :
            'bg-slate-400 text-white'
          }`}>{listing.confidence_level} confidence</span>
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-600">Title</Label>
          <Input value={listing.title} onChange={e => setListing(l => ({ ...l, title: e.target.value }))} className="h-11 mt-1" />
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-600">Description</Label>
          <Textarea value={listing.description} onChange={e => setListing(l => ({ ...l, description: e.target.value }))} className="min-h-24 mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium text-slate-600">Condition</Label>
            <Input value={listing.condition} onChange={e => setListing(l => ({ ...l, condition: e.target.value }))} className="h-11 mt-1" placeholder="e.g., Good" />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-600">Size</Label>
            <Input value={listing.size} onChange={e => setListing(l => ({ ...l, size: e.target.value }))} className="h-11 mt-1" placeholder="e.g., L" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium text-slate-600">Color</Label>
            <Input value={listing.color} onChange={e => setListing(l => ({ ...l, color: e.target.value }))} className="h-11 mt-1" placeholder="e.g., Blue" />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-600">Suggested Price ($)</Label>
            <Input type="number" value={listing.suggested_price} onChange={e => setListing(l => ({ ...l, suggested_price: parseFloat(e.target.value) }))} className="h-11 mt-1" placeholder="0.00" />
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Location
            {locationLoading && <span className="text-xs text-slate-400 ml-1">(detecting...)</span>}
          </Label>
          <Input value={location} onChange={e => setLocation(e.target.value)} className="h-11 mt-1" placeholder="e.g., Chicago, IL" />
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
          <span className="font-medium">Price Range: </span>
          ${listing.price_range_low?.toFixed(2)} – ${listing.price_range_high?.toFixed(2)}
        </div>

        {listing.reseller_tips?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Reseller Tips</p>
            <ul className="space-y-1">
              {listing.reseller_tips.map((tip, i) => (
                <li key={i} className="text-xs text-amber-900 flex gap-1.5">
                  <span className="shrink-0">•</span><span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button onClick={handleAddToInventory} disabled={saving} size="lg" className="h-14 bg-slate-900 hover:bg-slate-800 text-white text-sm">
            <Package className="w-4 h-4 mr-1.5" />
            Add to Inventory
          </Button>
          <Button onClick={handleSendPostingInfo} disabled={saving} size="lg" variant="outline" className="h-14 text-sm">
            <Send className="w-4 h-4 mr-1.5" />
            Send Posting Info
          </Button>
          <Button onClick={handleSaveListingDraft} disabled={saving} size="lg" variant="outline" className="h-14 text-sm col-span-1">
            <Save className="w-4 h-4 mr-1.5" />
            Save to Draft
          </Button>
          <Button onClick={handleSkip} disabled={saving} size="lg" variant="ghost" className="h-14 text-sm text-slate-500">
            <X className="w-4 h-4 mr-1.5" />
            Skip Listing
          </Button>
        </div>
      </div>
    );
  }

  // ── CAPTURE FORM ──────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Photo Manager */}
      <div>
        <Label className="text-base font-medium">Photos</Label>
        <div className="mt-2">
          <CapturePhotoManager ref={photoManagerRef} initialPhotos={initialPhotosData} />
        </div>
      </div>

      <div>
        <Label htmlFor="itemSpecs" className="text-base font-medium">Item Specs</Label>
        <p className="text-xs text-slate-500 mt-0.5 mb-1.5">Adding details helps the AI generate the best title, description, and recommended pricing.</p>
        <Textarea
          id="itemSpecs"
          value={itemSpecs}
          onChange={(e) => setItemSpecs(e.target.value)}
          placeholder="e.g., Nike Air Max 90 sneakers, white/black, size 10, barely worn..."
          className="min-h-20 text-base"
        />
      </div>

      <div>
        <Label htmlFor="purchasePrice" className="text-base font-medium">Purchase Price *</Label>
        <Input
          id="purchasePrice"
          type="number"
          step="0.01"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="0.00"
          className="h-12 text-base mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="brand" className="text-base font-medium">Brand (Optional)</Label>
        <Input
          id="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g., Nike"
          className="h-12 text-base mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="category" className="text-base font-medium">Category (Optional)</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., Clothing"
          className="h-12 text-base mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="internalNotes" className="text-base font-medium">Internal Notes (Optional)</Label>
        <Textarea
          id="internalNotes"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="For your eyes only — flaws, sourcing tips, reminders..."
          className="min-h-20 text-base mt-1.5"
        />
      </div>

      <Button
        onClick={handleCreateListing}
        disabled={generating || saving}
        size="lg"
        className="w-full h-14 text-base bg-amber-500 hover:bg-amber-600 text-white"
        data-testid="create-potential-listing"
      >
        {generating ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating listing...
          </div>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Create Potential Listing
          </>
        )}
      </Button>

      <Button
        onClick={handleSaveDraft}
        disabled={saving || generating}
        size="lg"
        variant="outline"
        className="w-full h-12 text-base"
        data-testid="save-quik-capture"
      >
        {saving ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
            Saving...
          </div>
        ) : (
          <>
            <Save className="w-5 h-5 mr-2" />
            Save Draft
          </>
        )}
      </Button>
    </div>
  );
}