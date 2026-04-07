import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap, Sparkles, RefreshCw, X, Check, Copy, ShoppingBag, Bookmark } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
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

// ── Platform Copy Modal (shown after List It) ───────────────────
const PLATFORMS = [
  { id: 'ebay', label: 'eBay', color: 'bg-yellow-400 text-slate-900' },
  { id: 'poshmark', label: 'Poshmark', color: 'bg-red-500 text-white' },
  { id: 'mercari', label: 'Mercari', color: 'bg-blue-500 text-white' },
  { id: 'facebook', label: 'Facebook Marketplace', color: 'bg-blue-700 text-white' },
  { id: 'offerup', label: 'OfferUp', color: 'bg-green-600 text-white' },
];

function PlatformModal({ title, description, price, onClose }) {
  const [copied, setCopied] = useState(null);

  const listingText = `${title}\n\n${description}\n\nPrice: $${parseFloat(price || 0).toFixed(2)}`;

  const copyToClipboard = async (platformId) => {
    try {
      await navigator.clipboard.writeText(listingText);
      setCopied(platformId);
      setTimeout(() => setCopied(null), 2000);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Copy failed — try selecting the text manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Post to a Platform</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500">Tap a platform to copy your listing text, then paste it in their app.</p>

        {/* Listing preview */}
        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed border border-slate-200">
          {listingText}
        </div>

        <div className="space-y-2">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => copyToClipboard(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-opacity ${p.color} ${copied === p.id ? 'opacity-70' : ''}`}
            >
              <span>{p.label}</span>
              {copied === p.id
                ? <Check className="w-4 h-4" />
                : <Copy className="w-4 h-4 opacity-70" />
              }
            </button>
          ))}
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
  const [price, setPrice] = useState(state.suggested_price ?? state.suggested_resale_price ?? '');
  const [purchasePrice, setPurchasePrice] = useState('');
  const photos = state.photosData || state.photos || [];

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUseGenerated = ({ title: t, description: d }) => {
    setTitle(t);
    setDescription(d);
    setShowGenerateModal(false);
    toast.success('Listing applied!');
  };

  const saveItem = async (status) => {
    setSaving(true);
    try {
      const user = await auth.me();
      const primaryPhoto = photos[0];
      const primaryPhotoUrl = primaryPhoto?.compressedUrl || primaryPhoto?.displayUrl || null;

      const item = await itemsDb.create({
        user_id: user.id,
        item_name: title.trim() || 'Untitled Item',
        brand: brand.trim() || null,
        category: category.trim() || null,
        condition: condition.trim() || null,
        internal_notes: description.trim() || null,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        suggested_list_price: price ? parseFloat(price) : null,
        status,
        primary_photo_url: primaryPhotoUrl,
        created_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Save photo records
      if (photos.length > 0) {
        await Promise.all(
          photos.map((p, i) => {
            const url = p.compressedUrl || p.displayUrl;
            if (!url) return Promise.resolve();
            return itemPhotosDb.create({
              item_id: item.id,
              original_photo: url,
              sort_order: i,
              is_cover: i === 0,
            });
          })
        );
      }

      return item;
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleClipIt = async () => {
    try {
      await saveItem('draft');
      toast.success('Clipped! Saved to My Items.');
      navigate('/Inventory', { state: { defaultTab: 'clipped' } });
    } catch {
      toast.error('Failed to save. Try again.');
    }
  };

  const handleListIt = async () => {
    try {
      await saveItem('listed');
      toast.success('Listed! Choose a platform below.');
      setShowPlatformModal(true);
    } catch {
      toast.error('Failed to save. Try again.');
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

          {/* Brand / Category / Condition */}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-slate-700">Condition</Label>
              <Input value={condition} onChange={e => setCondition(e.target.value)} placeholder="Good" className="h-10 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">List Price ($)</Label>
              <Input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                className="h-10 mt-1 text-sm"
              />
            </div>
          </div>

          {/* What did you pay */}
          <div>
            <Label htmlFor="purchasePrice" className="text-sm font-medium text-slate-700">What did you pay?</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="h-11 pl-7 text-sm"
              />
            </div>
          </div>

          {/* Generate Listing */}
          <Button
            onClick={() => setShowGenerateModal(true)}
            size="lg"
            variant="outline"
            className="w-full h-12 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Listing
          </Button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleClipIt}
            disabled={saving}
            size="lg"
            variant="outline"
            className="h-14 text-base border-slate-300"
          >
            <Bookmark className="w-5 h-5 mr-2" />
            Clip It
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

      {showPlatformModal && (
        <PlatformModal
          title={title}
          description={description}
          price={price}
          onClose={() => {
            setShowPlatformModal(false);
            navigate('/Inventory', { state: { defaultTab: 'listed' } });
          }}
        />
      )}
    </div>
  );
}
