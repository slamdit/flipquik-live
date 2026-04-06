import React, { useState } from 'react';
import { Camera, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONFIDENCE_STYLES = {
  high:   'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-slate-100 text-slate-500',
};

export default function EvalResultCard({ rank, result, onCapture, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const { eval: ev, photoUrl } = result;

  const confidence = (ev.confidence || 'low').toLowerCase();
  const confStyle = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.low;
  const hasPrice = ev.suggested_resale_price != null;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {/* Rank badge */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
          #{rank}
        </div>

        {/* Thumbnail */}
        {photoUrl ? (
          <img src={photoUrl} className="w-16 h-16 object-cover rounded-lg shrink-0" alt={ev.item_name} />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-slate-300" />
          </div>
        )}

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{ev.item_name || 'Unknown Item'}</p>
          {ev.brand && <p className="text-xs text-slate-500">{ev.brand}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {hasPrice && (
              <span className="text-sm font-bold text-emerald-600">${ev.suggested_resale_price?.toFixed(2)}</span>
            )}
            {ev.resale_low != null && ev.resale_high != null && (
              <span className="text-xs text-slate-400">${ev.resale_low}–${ev.resale_high}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confStyle}`}>{confidence}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button size="sm" onClick={onCapture} className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white px-3">
            <Camera className="w-3 h-3 mr-1" />
            Capture
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} className="h-8 text-xs text-slate-400 hover:text-red-500 px-3">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600 py-1.5 border-t border-slate-50 hover:bg-slate-50 transition-colors"
      >
        {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />Details</>}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-50">
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            {ev.category && (
              <div><span className="text-slate-400">Category: </span><span className="text-slate-700">{ev.category}</span></div>
            )}
            {ev.condition && (
              <div><span className="text-slate-400">Condition: </span><span className="text-slate-700">{ev.condition}</span></div>
            )}
            {ev.retail_price != null && (
              <div><span className="text-slate-400">Retail: </span><span className="text-slate-700">${ev.retail_price}</span></div>
            )}
          </div>

          {ev.notes && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">{ev.notes}</p>
          )}

          {ev.things_to_consider?.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-xs font-semibold text-amber-700 mb-1">Things to Consider</p>
              <ul className="space-y-0.5">
                {ev.things_to_consider.map((tip, i) => (
                  <li key={i} className="text-xs text-amber-800 flex gap-1.5">
                    <span className="shrink-0">•</span><span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}