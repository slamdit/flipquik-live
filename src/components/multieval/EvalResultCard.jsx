import React, { useState } from 'react';
import { Camera, Trash2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EvalResultCard({ rank, result, onSendToQuikEval, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const { eval: ev, photoUrl } = result;

  const isWorthALook = ev.flip_signal === 'WORTH A LOOK';

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        {photoUrl ? (
          <img src={photoUrl} className="w-16 h-16 object-cover rounded-lg shrink-0" alt="" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-slate-300" />
          </div>
        )}

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-snug">{ev.potential_label || 'Unknown'}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              isWorthALook
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {ev.flip_signal || 'PROBABLY SKIP'}
            </span>
            {ev.rough_range && (
              <span className="text-sm font-bold text-slate-700">{ev.rough_range}</span>
            )}
          </div>
        </div>

        {/* Remove */}
        <button onClick={onRemove} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expand / collapse one_liner */}
      {ev.one_liner && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600 py-1.5 border-t border-slate-50 hover:bg-slate-50 transition-colors"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />Why?</>}
          </button>
          {expanded && (
            <p className="px-4 pb-3 text-xs text-slate-600 leading-relaxed border-t border-slate-50">{ev.one_liner}</p>
          )}
        </>
      )}

      {/* Send to QuikEval — only for WORTH A LOOK */}
      {isWorthALook && (
        <div className="px-3 pb-3 pt-1">
          <Button
            size="sm"
            onClick={onSendToQuikEval}
            className="w-full h-9 text-xs bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Zap className="w-3 h-3 mr-1.5" />
            Send to QuikEval →
          </Button>
        </div>
      )}
    </div>
  );
}
