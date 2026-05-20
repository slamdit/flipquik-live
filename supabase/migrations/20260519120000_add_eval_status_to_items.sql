-- Sprint 2: background AI eval queue.
-- Adds eval_status / eval_error to items so the browser-side EvalQueueProvider
-- can find clips that need an AI run, and so the Drafts Inbox can render
-- per-clip status badges (ready / processing / failed).
--
-- eval_status values:
--   null       = no eval ever requested (legacy clips, or items the user
--                typed in by hand and never asked AI to fill).
--   'pending'  = needs AI run. Background queue picks these up.
--   'complete' = AI fields populated successfully.
--   'failed'   = last run errored; eval_error has the message. User can retry.
--
-- Additive only. No backfill on existing rows — Sally explicitly chose
-- the one-time opt-in prompt path over silently re-evaluating history.

alter table public.items
  add column if not exists eval_status text,
  add column if not exists eval_error  text;

create index if not exists items_eval_status_pending_idx
  on public.items (user_id, eval_status)
  where eval_status = 'pending';
