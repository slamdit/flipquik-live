import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calculator, ShoppingCart, X, BookmarkPlus } from 'lucide-react';
import AutoGenerateListing from './AutoGenerateListing';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function QuickEvaluate({ photos, onSuccess }) {
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleEvaluate = () => {
    if (!purchasePrice) {
      toast.error('Please enter a purchase price');
      return;
    }

    setEvaluating(true);
    
    const categoryLower = category.toLowerCase();
    let multiplier = 4;
    let categoryLabel = 'general items';
    
    if (categoryLower.includes('clothing') || categoryLower.includes('apparel')) {
      multiplier = 5; categoryLabel = 'clothing';
    } else if (categoryLower.includes('shoe') || categoryLower.includes('sneaker')) {
      multiplier = 4; categoryLabel = 'footwear';
    } else if (categoryLower.includes('electronic') || categoryLower.includes('tech')) {
      multiplier = 3; categoryLabel = 'electronics';
    } else if (categoryLower.includes('vintage') || categoryLower.includes('antique')) {
      multiplier = 7; categoryLabel = 'vintage/antique items';
    }
    
    const price = parseFloat(purchasePrice);
    const estimatedResale = price * multiplier;
    const suggestedPrice = Math.round(estimatedResale * 0.9 * 100) / 100;
    const estimatedProfit = Math.round((suggestedPrice - price) * 100) / 100;
    const roiPercent = Math.round((estimatedProfit / price) * 100);
    const resaleLow = Math.round(estimatedResale * 0.8 * 100) / 100;
    const resaleHigh = Math.round(estimatedResale * 1.2 * 100) / 100;

    // Confidence based on how much info was provided
    const filledFields = [itemName, brand, category, notes].filter(v => v.trim()).length;
    const confidence = filledFields >= 3 ? 'Medium' : filledFields >= 1 ? 'Low' : 'Very Low';
    const missing = [!brand && 'brand', !category && 'category', !itemName && 'item name', !notes && 'condition notes'].filter(Boolean);
    
    setEvaluation({
      resale_low: resaleLow,
      resale_high: resaleHigh,
      suggested_price: suggestedPrice,
      estimated_profit: estimatedProfit,
      roi_percent: roiPercent,
      confidence,
      basis: `Based on typical ${categoryLabel} resale multiples (~${multiplier}x purchase price).`,
      missing_info: missing.length > 0 ? `Missing: ${missing.join(', ')}.` : null
    });
    
    setEvaluating(false);
  };

  const createItem = async (status) => {
    const user = await base44.auth.me();
    
    const searchKeywords = [
      itemName.trim(),
      brand.trim(),
      category.trim()
    ].filter(Boolean).join(' ').toLowerCase();

    const item = await base44.entities.Item.create({
      user_id: user.id,
      item_name: itemName.trim() || 'Quick evaluate item',
      brand: brand.trim() || undefined,
      category: category.trim() || undefined,
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
      notes: notes.trim() || undefined,
      status,
      primary_photo_url: photos[0] || undefined,
      search_text: searchKeywords,
      updated_at: new Date().toISOString()
    });

    if (photos.length > 0) {
      const photoPromises = photos.map((photoUrl, index) =>
        base44.entities.ItemPhoto.create({
          item_id: item.id,
          original_photo: photoUrl,
          sort_order: index,
          is_cover: index === 0
        })
      );
      await Promise.all(photoPromises);
    }

    return item;
  };

  const handleBuy = async () => {
    setActionLoading(true);
    try {
      await createItem('captured');
      toast.success('Item captured - ready to draft!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save item');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePass = () => {
    toast.success('Item passed');
    onSuccess();
  };

  const handleSaveForLater = async () => {
    setActionLoading(true);
    try {
      await createItem('research');
      toast.success('Saved for research');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save item');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="evalItemName" className="text-base font-medium">Item Name</Label>
        <Input
          id="evalItemName"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="e.g., Nike Hoodie"
          className="h-12 text-base mt-1.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="evalBrand" className="text-base font-medium">Brand</Label>
          <Input
            id="evalBrand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Nike"
            className="h-12 text-base mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="evalCategory" className="text-base font-medium">Category</Label>
          <Input
            id="evalCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Clothing"
            className="h-12 text-base mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="evalPrice" className="text-base font-medium">Purchase Price *</Label>
        <Input
          id="evalPrice"
          type="number"
          step="0.01"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="0.00"
          className="h-12 text-base mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="evalNotes" className="text-base font-medium">Quick Notes</Label>
        <Textarea
          id="evalNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes..."
          className="min-h-20 text-base mt-1.5"
        />
      </div>

      {!evaluation ? (
        <Button
          onClick={handleEvaluate}
          disabled={evaluating}
          size="lg"
          className="w-full h-14 text-base bg-slate-900 hover:bg-slate-800"
          data-testid="evaluate-item"
        >
          {evaluating ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Evaluating...
            </div>
          ) : (
            <>
              <Calculator className="w-5 h-5 mr-2" />
              Evaluate Item
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Quick Evaluation</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                evaluation.confidence === 'Medium' ? 'bg-yellow-500 text-slate-900' :
                'bg-slate-600 text-slate-300'
              }`}>{evaluation.confidence} confidence</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Resale Range</div>
                <div className="text-lg font-semibold">${evaluation.resale_low} – ${evaluation.resale_high}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Suggested Price</div>
                <div className="text-lg font-semibold">${evaluation.suggested_price}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Est. Profit</div>
                <div className="text-lg font-semibold text-green-400">${evaluation.estimated_profit}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">ROI</div>
                <div className="text-lg font-semibold text-green-400">{evaluation.roi_percent}%</div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-2 space-y-1">
              <p className="text-xs text-slate-400 leading-snug">{evaluation.basis}</p>
              {evaluation.missing_info && (
                <p className="text-xs text-amber-400 leading-snug">⚠ {evaluation.missing_info} Add more details for a better estimate.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={handleBuy}
              disabled={actionLoading}
              size="lg"
              className="h-14 bg-green-600 hover:bg-green-700"
              data-testid="evaluate-buy"
            >
              {actionLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mb-1" />
                  <div className="text-xs">BUY</div>
                </>
              )}
            </Button>
            
            <Button
              onClick={handlePass}
              disabled={actionLoading}
              size="lg"
              variant="outline"
              className="h-14"
              data-testid="evaluate-pass"
            >
              <X className="w-4 h-4 mb-1" />
              <div className="text-xs">PASS</div>
            </Button>
            
            <Button
              onClick={handleSaveForLater}
              disabled={actionLoading}
              size="lg"
              variant="outline"
              className="h-14"
              data-testid="evaluate-save-later"
            >
              {actionLoading ? (
                <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4 mb-1" />
                  <div className="text-xs">LATER</div>
                </>
              )}
            </Button>
          </div>

          <AutoGenerateListing
            itemData={{ item_name: itemName, brand, category, purchase_price: purchasePrice, notes }}
            photos={photos}
            onSaved={onSuccess}
          />
        </div>
      )}
    </div>
  );
}