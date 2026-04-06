import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ShoppingCart, X, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { compressImage } from '@/utils/imageCompression';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PhotoCapture from '@/components/capture/PhotoCapture';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const CONFIDENCE_STYLES = {
  high: 'bg-green-500 text-white',
  medium: 'bg-yellow-400 text-slate-900',
  low: 'bg-slate-500 text-white',
};

export default function QuikEval() {
  // photos: [{ originalFile, compressedUrl, displayUrl }]
  const [photos, setPhotos] = useState([]);
  const [itemSpecs, setItemSpecs] = useState('');
  const [uploading, setUploading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();



  const runEvaluation = async () => {
    setEvaluating(true);
    try {
      const evalResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert reseller assistant helping someone decide whether to buy an item at a thrift store or sale.

Analyze the provided image(s) carefully. If there's a barcode or tag visible, use that information silently to improve your results.
${itemSpecs ? `
The user has provided the following known details about the item: "${itemSpecs}". Use this to improve accuracy.
` : ''}
Your goal: identify the item and provide a conservative, realistic resale evaluation. Be highly skeptical of items that appear to be high value but lack clear authenticity. If an item *could* be high value but requires verification, explain what is needed for confirmation.

Return JSON with these fields:
- item_name: the most likely specific product name (brand + type + key detail)
- brand: brand name if identifiable
- category: product category (e.g. Clothing, Shoes, Electronics, Toys, etc.)
- condition: estimated condition from image (Excellent / Good / Fair / Poor)
- retail_price: approximate brand-new retail price in USD (null if unknown)
- resale_low: low end of realistic used resale price in USD
- resale_high: high end of realistic used resale price in USD
- suggested_resale_price: single best listing price in USD
- confidence: "low", "medium", or "high" based on how confidently you identified the item
- things_to_consider: array of 3-4 short practical tips for a reseller (platform fit, common issues, demand, timing, or specific authentication requirements like "check for authentication papers," "look for serial numbers," "examine for specific hallmarks" if high value is conditional on external verification)
- notes: 1-2 sentence summary of what you see and why someone would/wouldn't want to flip this. If confidence is low, explain why (e.g., potential counterfeit, too generic, missing key details for identification).

Be conservative. Do not inflate prices. Base estimates on realistic sold comps from top reseller sites (such as eBay, Poshmark, Mercari) within the last year.`,
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        file_urls: photos.map(p => p.compressedUrl || p),
        response_json_schema: {
          type: 'object',
          properties: {
            item_name: { type: 'string' },
            brand: { type: 'string' },
            category: { type: 'string' },
            condition: { type: 'string' },
            retail_price: { type: 'number' },
            resale_low: { type: 'number' },
            resale_high: { type: 'number' },
            suggested_resale_price: { type: 'number' },
            confidence: { type: 'string' },
            things_to_consider: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
        },
      });
      setResult(evalResult);
    } catch (err) {
      toast.error('Evaluation failed. Try again.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleCapture = () => {
    navigate('/Capture', {
      state: {
        prefill: {
          item_name: result.item_name || itemSpecs || '',
          brand: result.brand || '',
          category: result.category || '',
          condition: result.condition || '',
          notes: result.notes || '',
          suggested_price: result.suggested_resale_price,
          resale_low: result.resale_low,
          resale_high: result.resale_high,
        },
        photosData: photos, // full objects with originalFile + compressedUrl
      },
    });
  };

  const handleSkip = () => {
    setPhotos([]);
    setResult(null);
    setEvaluating(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <Zap className="w-7 h-7 text-amber-400" />
          <h1 className="text-2xl font-bold">QuikEval</h1>
        </div>
        <p className="text-slate-400 text-sm">Snap a photo — get instant resale intel</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Photo + trigger section */}
        {!result && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <PhotoCapture
              photos={photos}
              setPhotos={setPhotos}
              uploading={uploading}
              setUploading={setUploading}
            />
            <div>
              <Label htmlFor="itemSpecs" className="text-sm font-medium text-slate-700">Item Specs (optional)</Label>
              <p className="text-xs text-slate-400 mt-0.5 mb-1.5">Add any known details — brand, model, size, condition — to improve accuracy.</p>
              <Textarea
                id="itemSpecs"
                value={itemSpecs}
                onChange={(e) => setItemSpecs(e.target.value)}
                placeholder="e.g., Nike Air Max 90, size 10, white/black..."
                className="min-h-16 text-sm"
              />
            </div>
            <Button
              onClick={runEvaluation}
              disabled={photos.length === 0 || evaluating || uploading}
              size="lg"
              className="w-full h-14 text-base bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="quikeval-analyze"
            >
              <Zap className="w-5 h-5 mr-2" />
              Flip or Skip?
            </Button>
          </div>
        )}

        {/* Evaluating state */}
        {evaluating && (
          <div className="bg-white rounded-xl p-8 shadow-sm flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-amber-400 rounded-full animate-spin" />
            <div>
              <p className="font-semibold text-slate-900">Analyzing item...</p>
              <p className="text-sm text-slate-500 mt-1">Searching market data & sold comps</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !evaluating && (
          <div className="space-y-3">
            {/* Item identity */}
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-bold text-lg text-slate-900 leading-tight">{result.item_name}</p>
                  {result.brand && <p className="text-sm text-slate-500">{result.brand}</p>}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${CONFIDENCE_STYLES[result.confidence] || CONFIDENCE_STYLES.low}`}>
                  {result.confidence} confidence
                </span>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {result.category && <Badge variant="outline" className="text-xs">{result.category}</Badge>}
                {result.condition && <Badge variant="outline" className="text-xs">{result.condition}</Badge>}
              </div>
              {result.notes && (
                <p className="text-sm text-slate-600 mt-2 leading-snug">{result.notes}</p>
              )}
            </div>

            {/* Pricing */}
            <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Resale Estimate</p>
              {result.retail_price && (
                <div>
                  <p className="text-xs text-slate-400">Retail Price</p>
                  <p className="text-lg font-semibold">${result.retail_price?.toFixed(2)}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Resale Low</p>
                  <p className="text-base font-semibold">${result.resale_low?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Resale High</p>
                  <p className="text-base font-semibold">${result.resale_high?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Suggested</p>
                  <p className="text-base font-semibold text-amber-400">${result.suggested_resale_price?.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Things to consider */}
            {result.things_to_consider?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Things to Consider</p>
                <ul className="space-y-1.5">
                  {result.things_to_consider.map((tip, i) => (
                    <li key={i} className="text-sm text-amber-900 flex gap-2">
                      <span className="shrink-0 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Photo thumbnail row */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <img key={i} src={p.displayUrl || p} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-slate-200" />
              ))}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                onClick={handleSkip}
                size="lg"
                variant="outline"
                className="h-14 text-base border-slate-300"
                data-testid="quikeval-skip"
              >
                <X className="w-5 h-5 mr-2" />
                Skip Flip
              </Button>
              <Button
                onClick={handleCapture}
                size="lg"
                className="h-14 text-base bg-slate-900 hover:bg-slate-800"
                data-testid="quikeval-capture"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Capture
              </Button>
            </div>

            {/* Re-evaluate */}
            <button
              onClick={() => { setResult(null); runEvaluation(); }}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-600 py-1"
            >
              <RefreshCw className="w-4 h-4" />
              Re-evaluate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}