import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const CONFIDENCE_COLORS = {
  high: 'bg-green-500 text-white',
  medium: 'bg-yellow-400 text-slate-900',
  low: 'bg-slate-400 text-white',
};

export default function AutoGenerateListing({ itemData, photos, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();

      // Save item first
      const searchKeywords = [
        itemData.item_name, itemData.brand, itemData.category
      ].filter(Boolean).join(' ').toLowerCase();

      const item = await base44.entities.Item.create({
        user_id: user.id,
        item_name: itemData.item_name?.trim() || 'Captured item',
        brand: itemData.brand?.trim() || undefined,
        category: itemData.category?.trim() || undefined,
        condition: itemData.condition?.trim() || undefined,
        purchase_price: itemData.purchase_price ? parseFloat(itemData.purchase_price) : undefined,
        notes: itemData.notes?.trim() || undefined,
        status: 'draft',
        primary_photo_url: photos[0] || undefined,
        search_text: searchKeywords,
        updated_at: new Date().toISOString(),
      });

      if (photos.length > 0) {
        await Promise.all(photos.map((url, i) =>
          base44.entities.ItemPhoto.create({
            item_id: item.id,
            original_photo: url,
            sort_order: i,
            is_cover: i === 0,
          })
        ));
      }

      // Call AI
      const prompt = `You are an experienced resale seller. Generate a complete listing package for the item below. Your goal is to help the item sell by writing clearly and honestly — like a trusted seller, not a copywriter.

Item Details:
- Name: ${itemData.item_name || 'Unknown item'}
- Brand: ${itemData.brand || 'Not specified'}
- Category: ${itemData.category || 'Not specified'}
- Condition: ${itemData.condition || 'Not specified'}
- Purchase Price: ${itemData.purchase_price ? '$' + itemData.purchase_price : 'Not specified'}
- Notes: ${itemData.notes || 'None'}
- Has Photo: ${photos.length > 0 ? 'Yes' : 'No'}

Instructions:

title:
- Max 80 characters
- Start with brand if known
- Include item type, key feature or style detail, and condition if notable
- No filler words, no invented specs

description:
- 2 to 4 sentences
- Clear, buyer-friendly, and professional
- Identify the item clearly in the first sentence
- Mention brand if known
- Mention important style, fit, or use details if provided
- Mention packaging or accessories only if noted in the item details
- Describe condition honestly — do not upgrade or downgrade it beyond what is stated
- Do NOT invent materials, measurements, authenticity claims, flaws, or rarity
- Do NOT use phrases like "see photos", "must-have", or "look no further"
- Sound like a trustworthy, experienced seller who wants the buyer to be satisfied

price_range_low and price_range_high: realistic secondhand market range in USD based on item type, brand, and condition
suggested_price: single best list price within that range
confidence_level: "low", "medium", or "high" based on how much info is available
reseller_tips: 2 to 4 short practical tips for posting this specific item (platform fit, shipping, photography, timing)

Return JSON only.`;

      const ai = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            price_range_low: { type: 'number' },
            price_range_high: { type: 'number' },
            suggested_price: { type: 'number' },
            confidence_level: { type: 'string' },
            reseller_tips: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      // Save to ListingDraft
      await base44.entities.ListingDraft.create({
        item_id: item.id,
        title: ai.title,
        description: ai.description,
        price_suggestion: ai.suggested_price,
        listing_status: 'ready',
      });

      setEditTitle(ai.title || '');
      setEditDesc(ai.description || '');
      setResult(ai);
      toast.success('Listing generated and saved!');
      if (onSaved) onSaved();
    } catch (err) {
      toast.error('Failed to generate listing');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4 mt-4 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-sm text-slate-900">Generated Listing</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[result.confidence_level] || CONFIDENCE_COLORS.low}`}>
            {result.confidence_level} confidence
          </span>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Title</label>
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-sm h-10" />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Description</label>
          <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="text-sm min-h-20" />
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-3">
          <div className="text-xs text-slate-400 mb-0.5">Price Range</div>
          <div className="font-semibold">${result.price_range_low} – ${result.price_range_high}</div>
          <div className="text-xs text-slate-400 mt-2 mb-0.5">Suggested List Price</div>
          <div className="text-lg font-bold text-green-400">${result.suggested_price}</div>
        </div>

        {result.reseller_tips?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2">Reseller Tips</p>
            <ul className="space-y-1">
              {result.reseller_tips.map((tip, i) => (
                <li key={i} className="text-xs text-amber-900 flex gap-1.5">
                  <span className="shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading}
      size="lg"
      className="w-full h-13 text-base bg-amber-500 hover:bg-amber-600 text-white mt-2"
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Generating...
        </div>
      ) : (
        <>
          <Sparkles className="w-5 h-5 mr-2" />
          ✨ Auto Generate Listing
        </>
      )}
    </Button>
  );
}