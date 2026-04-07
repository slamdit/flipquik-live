import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Sparkles, X, Camera, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import EvalResultCard from '@/components/multieval/EvalResultCard';

// Compress and encode a File as base64 JPEG for Claude vision
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX) { height = (height * MAX) / width; width = MAX; }
        if (height > MAX) { width = (width * MAX) / height; height = MAX; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function MultiEval() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [results, setResults] = useState([]);
  const [evaluating, setEvaluating] = useState(false);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({ url: URL.createObjectURL(file), file }));
    setPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const handleEvaluate = async () => {
    if (photos.length === 0) { toast.error('Add at least one photo first'); return; }
    setEvaluating(true);
    try {
      // Encode photos as base64 for Claude vision (no storage upload needed)
      const base64_images = await Promise.all(photos.map(p => fileToBase64(p.file)));

      const prompt = `You are an expert resale buyer evaluating items for resale value.
You are given ${photos.length} photo(s), each showing a different item.
For EACH item/photo (in the same order as provided), identify what the item is and evaluate its resale potential.

Return a JSON object with an "items" array containing evaluations in the same order as the photos.
Be concise but accurate. Use real market data to estimate prices.`;

      const { data, error } = await supabase.functions.invoke('quikeval', {
        body: {
          prompt,
          base64_images,
          response_json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item_name:              { type: 'string' },
                    brand:                  { type: 'string' },
                    category:               { type: 'string' },
                    condition:              { type: 'string' },
                    retail_price:           { type: 'number' },
                    resale_low:             { type: 'number' },
                    resale_high:            { type: 'number' },
                    suggested_resale_price: { type: 'number' },
                    confidence:             { type: 'string' },
                    things_to_consider:     { type: 'array', items: { type: 'string' } },
                    notes:                  { type: 'string' },
                  },
                },
              },
            },
          },
        },
      });

      if (error) throw error;

      const evalItems = data?.items || [];
      const paired = evalItems.map((ev, i) => ({
        id: Date.now() + i,
        eval: ev,
        photoUrl: photos[i]?.url || null,
      }));
      paired.sort((a, b) => (b.eval.suggested_resale_price || 0) - (a.eval.suggested_resale_price || 0));

      setResults(prev => [...prev, ...paired]);
      setPhotos([]);
      toast.success(`Evaluated ${paired.length} item${paired.length !== 1 ? 's' : ''}!`);
    } catch (err) {
      toast.error('Evaluation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setEvaluating(false);
    }
  };

  const removeResult = (id) => setResults(prev => prev.filter(r => r.id !== id));

  const handleCapture = (result) => {
    navigate('/flip-it', {
      state: {
        item_name: result.eval.item_name,
        brand: result.eval.brand,
        category: result.eval.category,
        condition: result.eval.condition,
        notes: result.eval.notes,
        suggested_resale_price: result.eval.suggested_resale_price,
        photosData: result.photoUrl ? [{ displayUrl: result.photoUrl, compressedUrl: result.photoUrl }] : [],
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Layers className="w-7 h-7 text-amber-400" />
          <h1 className="text-2xl font-bold">MultiEval</h1>
        </div>
        <p className="text-slate-400 text-sm">Snap multiple items, rank by resale value instantly</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Add Item Photos</p>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.url} className="w-20 h-20 object-cover rounded-lg" alt={`Item ${i + 1}`} />
                  <button onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">#{i + 1}</div>
                </div>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handlePhotoAdd} />
          <Button variant="outline" className="w-full h-12 border-dashed border-slate-300 text-slate-600" onClick={() => fileInputRef.current?.click()}>
            <Camera className="w-4 h-4 mr-2" />
            {photos.length > 0 ? `Add More Photos (${photos.length} added)` : 'Take / Upload Photos'}
          </Button>
        </div>

        {photos.length > 0 && (
          <Button onClick={handleEvaluate} disabled={evaluating} size="lg" className="w-full h-14 text-base bg-amber-500 hover:bg-amber-600 text-white">
            {evaluating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Evaluating {photos.length} item{photos.length !== 1 ? 's' : ''}...
              </div>
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" />Evaluate {photos.length} Item{photos.length !== 1 ? 's' : ''}</>
            )}
          </Button>
        )}

        {results.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-700">{results.length} Item{results.length !== 1 ? 's' : ''} — Ranked by Resale Value</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-slate-400" onClick={() => setResults([])}>Clear All</Button>
            </div>
            <div className="space-y-3">
              {results.map((result, i) => (
                <EvalResultCard key={result.id} rank={i + 1} result={result} onCapture={() => handleCapture(result)} onRemove={() => removeResult(result.id)} />
              ))}
            </div>
          </>
        )}

        {results.length === 0 && photos.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No items evaluated yet</p>
            <p className="text-xs text-slate-400 mt-1">Add photos above and tap Evaluate to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
