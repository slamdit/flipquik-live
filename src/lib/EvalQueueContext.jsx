import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase, items as itemsDb } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// Browser-side background worker that runs Claude Vision evals for items
// with eval_status='pending'. Lives in its own context — explicitly NOT
// merged into AuthContext (the landmine: async writes there desync the
// auth state). Reads useAuth() to know who to scope queries to.

const EvalQueueContext = createContext(null);

const POLL_INTERVAL_MS = 15_000; // every 15s, look for new pending items
const PROMPT = `You are an expert reseller assistant. Identify this item and provide a conservative resale evaluation.

Return JSON with these fields:
- item_name: most likely specific product name (brand + model number/SKU + type)
- brand: brand name if identifiable
- category: product category
- condition: estimated condition from image (Excellent / Good / Fair / Poor)
- retail_price: approximate new retail price in USD (null if unknown)
- resale_low: low end of realistic used resale price in USD
- resale_high: high end of realistic used resale price in USD
- suggested_resale_price: single best listing price in USD
- confidence: "low", "medium", or "high"
- notes: 1-2 sentence summary
- ebay_search_query: optimized eBay search string

Be conservative. Base estimates on realistic sold comps from eBay/Poshmark/Mercari within the last year.`;

const EVAL_SCHEMA = {
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
    notes: { type: 'string' },
    ebay_search_query: { type: 'string' },
  },
};

function safeNum(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

async function fetchItemPhotosAsBase64(itemId) {
  const { data: photos } = await supabase
    .from('item_photos')
    .select('public_url, original_photo, photo_url, storage_path')
    .eq('item_id', itemId)
    .order('sort_order', { ascending: true })
    .limit(4);

  const urls = (photos || [])
    .map(p => p.public_url || p.original_photo || p.photo_url)
    .filter(Boolean);

  const out = [];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const comma = dataUrl.indexOf(',');
          resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      out.push(b64);
    } catch {
      // Skip unreachable photos — the eval can run on whatever's available.
    }
  }
  return out;
}

async function runEvalForItem(itemId) {
  const base64Images = await fetchItemPhotosAsBase64(itemId);
  if (base64Images.length === 0) {
    throw new Error('No photos available for eval');
  }

  const { data, error } = await supabase.functions.invoke('quikeval', {
    body: {
      prompt: PROMPT,
      base64_images: base64Images,
      response_json_schema: EVAL_SCHEMA,
    },
  });
  if (error) throw error;
  if (!data || data.error) throw new Error(data?.error || 'Empty eval response');

  return {
    name: data.item_name || undefined,
    brand: data.brand || undefined,
    category: data.category || undefined,
    condition: data.condition || undefined,
    notes: data.notes || undefined,
    resale_low: safeNum(data.resale_low),
    resale_high: safeNum(data.resale_high),
    suggested_price: safeNum(data.suggested_resale_price),
  };
}

export const EvalQueueProvider = ({ children }) => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const inFlightRef = useRef(false);
  const refreshTickRef = useRef(0);

  // Forces consumers (Drafts Inbox, Inventory) to refetch when a queue
  // event lands. They subscribe to refreshTick via the context value.
  const [refreshTick, setRefreshTick] = useState(0);
  const bumpRefresh = useCallback(() => {
    refreshTickRef.current += 1;
    setRefreshTick(refreshTickRef.current);
  }, []);

  const fetchPendingCount = useCallback(async () => {
    if (!user) { setPendingCount(0); return; }
    const { count } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('eval_status', 'pending');
    setPendingCount(count || 0);
  }, [user]);

  const processNext = useCallback(async () => {
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const { data: candidates } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', user.id)
        .eq('eval_status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      const itemId = candidates?.[0]?.id;
      if (!itemId) {
        await fetchPendingCount();
        return;
      }

      setProcessingId(itemId);

      try {
        const evalFields = await runEvalForItem(itemId);
        await itemsDb.update(itemId, {
          ...evalFields,
          eval_status: 'complete',
          eval_error: null,
        });
      } catch (err) {
        console.error('[EvalQueue] eval failed for item', itemId, err);
        await itemsDb.update(itemId, {
          eval_status: 'failed',
          eval_error: err?.message || String(err),
        });
      } finally {
        setProcessingId(null);
        bumpRefresh();
        await fetchPendingCount();
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [user, fetchPendingCount, bumpRefresh]);

  // Poll loop: every 15s look for pending work. Cheap query (head:true).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await fetchPendingCount();
      if (!cancelled) await processNext();
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [user, fetchPendingCount, processNext]);

  // Kick the queue when the network comes back online — covers the
  // "clipped in the thrift store, eval finishes when signal returns" case.
  useEffect(() => {
    const onOnline = () => processNext();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [processNext]);

  // Public API. Callers (Clip Now, Clip & Next, retry button) can request
  // an immediate run instead of waiting for the next poll tick.
  const enqueueNow = useCallback(() => {
    fetchPendingCount();
    processNext();
  }, [fetchPendingCount, processNext]);

  // Retry a single failed item: flip its status back to 'pending' and
  // kick the worker.
  const retry = useCallback(async (itemId) => {
    await itemsDb.update(itemId, { eval_status: 'pending', eval_error: null });
    bumpRefresh();
    enqueueNow();
  }, [enqueueNow, bumpRefresh]);

  return (
    <EvalQueueContext.Provider value={{
      pendingCount,
      processingId,
      refreshTick,
      enqueueNow,
      retry,
    }}>
      {children}
    </EvalQueueContext.Provider>
  );
};

export const useEvalQueue = () => {
  const ctx = useContext(EvalQueueContext);
  if (!ctx) {
    // Render outside the provider (logged-out routes) — return inert stub.
    return { pendingCount: 0, processingId: null, refreshTick: 0, enqueueNow: () => {}, retry: async () => {} };
  }
  return ctx;
};
