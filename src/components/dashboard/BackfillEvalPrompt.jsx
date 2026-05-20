import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useEvalQueue } from '@/lib/EvalQueueContext';
import { toast } from 'sonner';

// Opt-in one-time prompt: on first Dashboard load after the Sprint 2 deploy,
// if the user has clipped items that pre-date the eval queue (eval_status IS
// NULL), offer to run AI eval on them. Sally explicitly chose this over
// silent auto-eval — quota burn must be opt-in.

const DISMISS_KEY = 'fq-backfill-eval-dismissed-v1';

export default function BackfillEvalPrompt() {
  const [unevaluatedCount, setUnevaluatedCount] = useState(0);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [enqueuing, setEnqueuing] = useState(false);
  const { enqueueNow } = useEvalQueue();

  useEffect(() => {
    if (dismissed) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { count } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'clipped')
        .is('eval_status', null);
      setUnevaluatedCount(count || 0);
    })();
  }, [dismissed]);

  if (dismissed) return null;
  if (unevaluatedCount === 0) return null;

  const handleRun = async () => {
    setEnqueuing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not signed in');
      // Mark all the user's older clipped-with-no-eval items as pending.
      // EvalQueueProvider picks them up on the next tick.
      const { error } = await supabase
        .from('items')
        .update({ eval_status: 'pending' })
        .eq('user_id', session.user.id)
        .eq('status', 'clipped')
        .is('eval_status', null);
      if (error) throw error;
      enqueueNow();
      toast.success(`Queued ${unevaluatedCount} clip${unevaluatedCount === 1 ? '' : 's'} for AI eval.`);
      localStorage.setItem(DISMISS_KEY, '1');
      setDismissed(true);
    } catch (err) {
      console.error('[BackfillEvalPrompt] failed:', err);
      toast.error(err?.message || 'Failed to queue. Try again.');
    } finally {
      setEnqueuing(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          {unevaluatedCount} older clip{unevaluatedCount === 1 ? ' has' : 's have'} no AI eval yet
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Run them now to backfill brand, category, and pricing. Uses your daily QuikEval quota.
        </p>
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleRun}
            disabled={enqueuing}
            className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs"
          >
            {enqueuing ? 'Queueing...' : 'Run now'}
          </Button>
          <button
            onClick={handleDismiss}
            disabled={enqueuing}
            className="text-xs text-amber-700 hover:text-amber-900 px-2"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        disabled={enqueuing}
        className="text-amber-400 hover:text-amber-600 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
