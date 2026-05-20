import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Package, ChevronRight, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEvalQueue } from '@/lib/EvalQueueContext';

function statusPill(item) {
  if (item.eval_status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Processing
      </span>
    );
  }
  if (item.eval_status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
        <AlertCircle className="w-2.5 h-2.5" />
        Failed
      </span>
    );
  }
  if (item.eval_status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
        <Sparkles className="w-2.5 h-2.5" />
        Ready
      </span>
    );
  }
  return null; // null/legacy — no AI run ever requested; no pill.
}

export default function DraftsInbox() {
  const { refreshTick } = useEvalQueue();

  const { data: clips = [], refetch, isLoading } = useQuery({
    queryKey: ['drafts-inbox-clips'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];
      const { data } = await supabase
        .from('items')
        .select('id, name, primary_photo_url, eval_status, created_at')
        .eq('user_id', session.user.id)
        .eq('status', 'clipped')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Refetch whenever the background queue completes an eval — keeps the
  // status pills live without a manual reload.
  useEffect(() => {
    if (refreshTick > 0) refetch();
  }, [refreshTick, refetch]);

  if (isLoading) return null;
  if (clips.length === 0) return null;

  const processing = clips.filter(c => c.eval_status === 'pending').length;
  const ready = clips.filter(c => c.eval_status === 'complete').length;
  const failed = clips.filter(c => c.eval_status === 'failed').length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Clips waiting to finish
        </p>
        <span className="text-xs text-slate-400">
          {clips.length} total
          {processing > 0 && <span className="ml-2 text-yellow-700">· {processing} processing</span>}
          {ready > 0 && <span className="ml-2 text-emerald-700">· {ready} ready</span>}
          {failed > 0 && <span className="ml-2 text-red-700">· {failed} failed</span>}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        {clips.map(c => (
          <Link
            key={c.id}
            to="/Inventory"
            state={{ defaultTab: 'clipped' }}
            className="flex items-center gap-3 px-3 py-2.5 active:bg-slate-50"
          >
            <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-slate-100">
              {c.primary_photo_url ? (
                <img src={c.primary_photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {c.name || 'Untitled clip'}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                {statusPill(c)}
                <span className="text-[10px] text-slate-400">
                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </Link>
        ))}
      </div>

      <Link
        to="/Inventory"
        state={{ defaultTab: 'clipped' }}
        className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 py-1"
      >
        <FileText className="w-3.5 h-3.5" />
        Open in My Items
      </Link>
    </div>
  );
}
