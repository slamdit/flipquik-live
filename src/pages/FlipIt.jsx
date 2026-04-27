import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap, Sparkles, RefreshCw, X, Check, Copy, ShoppingBag, Bookmark, Mail, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { auth, items as itemsDb, itemPhotos as itemPhotosDb, supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Generate Listing Modal ──────────────────────────────────────
function GenerateListingModal({ itemName, brand, category, condition, notes, photos, onUse, onClose }) {
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

      const base64_images = photos.map(p => p.base64).filter(Boolean);

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

  // Auto-generate on mount
  React.useEffect(() => { generate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold text-slate-900 text-lg">AI Listing</h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Writing your listing...</p>
          </div>
        ) : generated ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-600">Title</Label>
              <Textarea
                value={generated.title}
                onChange={e => setGenerated(g => ({ ...g, title: e.target.value }))}
                className="mt-1 min-h-16 text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-600">Description</Label>
              <Textarea
                value={generated.description}
                onChange={e => setGenerated(g => ({ ...g, description: e.target.value }))}
                className="mt-1 min-h-28 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                onClick={generate}
                size="lg"
                variant="outline"
                className="h-12 text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Remix
              </Button>
              <Button
                onClick={() => onUse(generated)}
                size="lg"
                className="h-12 text-sm bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Use This
              </Button>
              <Button
                onClick={onClose}
                size="lg"
                variant="ghost"
                className="h-12 text-sm text-slate-500"
              >
                <X className="w-4 h-4 mr-1.5" />
                Never mind
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm mb-4">Something went wrong.</p>
            <Button onClick={generate} variant="outline">Try Again</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Send Listing Modal (shown after List It) ───────────────────
function SendListingModal({ title, description, price, brand, category, condition, size, color, storageLocation, photos, onClose }) {
  const [copied, setCopied] = useState(false);

  const fields = [
    ['Title', title],
    ['Description', description],
    ['Brand', brand],
    ['Category', category],
    ['Condition', condition],
    ['Size', size],
    ['Color', color],
    ['List Price', price ? `$${parseFloat(price).toFixed(2)}` : ''],
    ['Storage Location', storageLocation],
  ].filter(([, v]) => v);

  const formattedText = fields.map(([k, v]) => `${k}: ${v}`).join('\n');
  const photoUrls = (photos || []).map(p => p.compressedUrl || p.displayUrl || p).filter(Boolean);
  const fullText = photoUrls.length > 0
    ? `${formattedText}\n\nPhotos:\n${photoUrls.join('\n')}`
    : formattedText;

  const handleEmail = () => {
    const subject = encodeURIComponent(`FlipQuik Listing: ${title || 'Item'}`);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Send Listing</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo thumbnails */}
        {photoUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photoUrls.map((url, i) => (
              <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-slate-200" />
            ))}
          </div>
        )}

        {/* Listing preview */}
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

// ── Main FlipIt Page ────────────────────────────────────────────
export default function FlipIt() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  // Editable fields pre-filled from QuikEval
  const [title, setTitle] = useState(state.item_name || '');
  const [description, setDescription] = useState(state.notes || '');
  const [brand, setBrand] = useState(state.brand || '');
  const [category, setCategory] = useState(state.category || '');
  const [condition, setCondition] = useState(state.condition || '');
  const [size, setSize] = useState(state.size || '');
  const [color, setColor] = useState(state.color || '');
  const [storageLocation, setStorageLocation] = useState('');
  const [price, setPrice] = useState(state.suggested_price ?? state.suggested_resale_price ?? '');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchasePriceError, setPurchasePriceError] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const purchasePriceRef = useRef(null);
  const photos = state.photosData || state.photos || [];

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUseGenerated = ({ title: t, description: d }) => {
    setTitle(t);
    setDescription(d);
    setShowGenerateModal(false);
    toast.success('Listing applied!');
  };

  // Returns false and highlights field if purchase price is missing
  const validatePurchasePrice = () => {
    if (purchasePrice === '') {
      setPurchasePriceError(true);
      purchasePriceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      purchasePriceRef.current?.querySelector('input')?.focus();
      return false;
    }
    setPurchasePriceError(false);
    return true;
  };

  const saveItem = async (status) => {
    setSaving(true);
    try {
      // Verify session first — getSession is local/cached, no server round-trip
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not signed in. Please sign in and try again.');
      }
      const userId = session.user.id;

      const primaryPhoto = photos[0];
      const primaryPhotoUrl = primaryPhoto?.compressedUrl || primaryPhoto?.displayUrl || null;

      // Only send columns confirmed to exist in the items table.
      // created_date is auto-generated by the DB (omitting it lets the DEFAULT fire).
      // updated_at is handled the same way on create.
      const item = await itemsDb.create({
        user_id: userId,
        name: title.trim() || 'Untitled Item',
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        condition: condition.trim() || undefined,
        size: size.trim() || undefined,
        color: color.trim() || undefined,
        storage_location: storageLocation.trim() || undefined,
        internal_notes: internalNotes.trim() || undefined,
        cost: parseFloat(purchasePrice),
        status,
        primary_photo_url: primaryPhotoUrl || undefined,
        updated_at: new Date().toISOString(),
      });

      // Save photo records — non-blocking
      if (photos.length > 0) {
        Promise.all(
          photos.map((p, i) => {
            const url = p.compressedUrl || p.displayUrl;
            if (!url) return Promise.resolve();
            return itemPhotosDb.create({
              user_id: userId,
              item_id: item.id,
              // Legacy columns — still read by EditItemModal.
              original_photo: url,
              is_cover: i === 0,
              // Phase 1A columns.
              public_url: url,
              storage_path: p.storagePath || null,
              sort_order: i,
              is_primary: i === 0,
              photo_type: 'listing',
              source: 'upload',
            });
          })
        ).catch(photoErr => console.error('[FlipIt] photo save failed:', photoErr));
      }

      return item;
    } catch (err) {
      console.error('[FlipIt] saveItem failed:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleClipIt = async () => {
    if (!validatePurchasePrice()) return;
    try {
      await saveItem('clipped');
      toast.success('Clipped! Saved to My Items.');
      navigate('/');
    } catch (err) {
      toast.error(err?.message || 'Failed to save. Try again.');
    }
  };

  const handleListIt = async () => {
    if (!validatePurchasePrice()) return;
    try {
      await saveItem('listed');
      toast.success('Listed! Send your listing below.');
      setShowSendModal(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to save. Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <Zap className="w-7 h-7 text-amber-400" />
          <h1 className="text-2xl font-bold">Flip It!</h1>
        </div>
        <p className="text-slate-400 text-sm">Review, edit, and list your item</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Action buttons + Generate — shown FIRST before scrolling to form */}
        <div className="space-y-2">
          <Button
            onClick={() => setShowGenerateModal(true)}
            size="lg"
            variant="outline"
            className="w-full h-12 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Listing
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleClipIt}
              disabled={saving}
              size="lg"
              variant="outline"
              className="h-14 text-base border-slate-300"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-600 rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                <>
                  <Bookmark className="w-5 h-5 mr-2" />
                  Clip It
                </>
              )}
            </Button>
            <Button
              onClick={handleListIt}
              disabled={saving}
              size="lg"
              className="h-14 text-base bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  List It!
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Photo strip */}
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <img
                key={i}
                src={p.displayUrl || p.compressedUrl || p}
                alt=""
                className="h-20 w-20 rounded-xl object-cover shrink-0 border border-slate-200"
              />
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          {/* What did you pay — required, FIRST */}
          <div ref={purchasePriceRef}>
            <Label htmlFor="purchasePrice" className="text-sm font-medium text-slate-700">
              What did you pay? <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={e => {
                  setPurchasePrice(e.target.value);
                  if (purchasePriceError && e.target.value !== '') setPurchasePriceError(false);
                }}
                placeholder="0.00"
                className={`h-11 pl-7 text-sm ${purchasePriceError ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
              />
            </div>
            {purchasePriceError && (
              <p className="text-xs text-red-500 mt-1">Purchase price is required (enter 0 if free)</p>
            )}
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium text-slate-700">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Nike Air Max 90 Size 10"
              className="h-11 mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium text-slate-700">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the item honestly..."
              className="mt-1 min-h-20 text-sm"
            />
          </div>

          {/* Brand + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-slate-700">Brand</Label>
              <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Nike" className="h-10 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Shoes" className="h-10 mt-1 text-sm" />
            </div>
          </div>

          {/* Condition + Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-slate-700">Condition</Label>
              <Input value={condition} onChange={e => setCondition(e.target.value)} placeholder="Good" className="h-10 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Size</Label>
              <Input value={size} onChange={e => setSize(e.target.value)} placeholder="10, M, etc." className="h-10 mt-1 text-sm" />
            </div>
          </div>

          {/* Color + Storage Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-slate-700">Color</Label>
              <Input value={color} onChange={e => setColor(e.target.value)} placeholder="Black" className="h-10 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Storage Location</Label>
              <Input value={storageLocation} onChange={e => setStorageLocation(e.target.value)} placeholder="Bin A3" className="h-10 mt-1 text-sm" />
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <Label htmlFor="internalNotes" className="text-sm font-medium text-slate-700">Internal Notes</Label>
            <p className="text-xs text-slate-400 mt-0.5 mb-1">Private — never shared in listings</p>
            <Textarea
              id="internalNotes"
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              placeholder="e.g. Got this at Goodwill on Main St, missing original tag..."
              className="min-h-20 text-sm"
            />
          </div>
        </div>
      </div>

      {showGenerateModal && (
        <GenerateListingModal
          itemName={title}
          brand={brand}
          category={category}
          condition={condition}
          notes={description}
          photos={photos}
          onUse={handleUseGenerated}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      {showSendModal && (
        <SendListingModal
          title={title}
          description={description}
          price={price}
          brand={brand}
          category={category}
          condition={condition}
          size={size}
          color={color}
          storageLocation={storageLocation}
          photos={photos}
          onClose={() => {
            setShowSendModal(false);
            navigate('/');
          }}
        />
      )}
    </div>
  );
}
