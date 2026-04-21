import React, { useState, useEffect } from 'react';
import { Lock, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import supabase from '@/lib/supabase';

const STOP_WORDS = new Set(['the', 'a', 'an', 'for', 'and', 'with', 'in', 'of', 'to', 'by', 'on', 'or', 'is', 'it', 'at']);

function getMatchQuality(itemName, compTitle) {
  if (!itemName || !compTitle) return 'similar';
  const words = itemName.toLowerCase().split(/[\s\-\/,]+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  if (words.length === 0) return 'similar';
  const titleLower = compTitle.toLowerCase();
  const matches = words.filter(w => titleLower.includes(w)).length;
  return matches / words.length > 0.7 ? 'close' : 'similar';
}

export default function EbaySoldComps({ itemName, isPro }) {
  const [comps, setComps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchedQuery, setSearchedQuery] = useState('');

  useEffect(() => {
    if (!isPro || !itemName) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearchedQuery(itemName);

    supabase.functions
      .invoke('ebay-sold-comps', { body: { query: itemName } })
      .then(({ data, error: fnErr }) => {
        if (cancelled) return;
        if (fnErr) {
          setError('Could not load eBay comps');
          return;
        }
        setComps(data?.comps || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load eBay comps');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isPro, itemName]);

  // ── FREE user: blurred teaser ──
  if (!isPro) {
    return (
      <div className="relative bg-slate-900 rounded-xl p-4 overflow-hidden">
        {/* Blurred fake content behind overlay */}
        <div className="filter blur-[4px] pointer-events-none select-none" aria-hidden="true">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">
            eBay Sold Comps
          </p>
          <p className="text-sm text-slate-400 mb-3">3 recent sales found</p>
          <div className="flex gap-2">
            <span className="bg-slate-700 text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">$24.99</span>
            <span className="bg-slate-700 text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">$31.50</span>
            <span className="bg-slate-700 text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">$19.95</span>
          </div>
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-[1px] rounded-xl">
          <Lock className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-white font-semibold text-sm mb-1">See what this actually sold for</p>
          <Button
            onClick={() => window.location.href = '/billing'}
            size="sm"
            className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            Upgrade to Pro &rarr; $19/mo
          </Button>
        </div>
      </div>
    );
  }

  // ── PRO user: real comps ──
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-slate-600 border-t-amber-400 rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading eBay comps...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 rounded-xl p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">eBay Sold Comps</p>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (comps.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">eBay Sold Comps</p>
        <p className="text-sm text-slate-500">No recent sold listings found.</p>
        {searchedQuery && (
          <p className="text-[11px] text-slate-600 italic mt-1">Searched: {searchedQuery}</p>
        )}
      </div>
    );
  }

  const avgPrice = comps.reduce((sum, c) => sum + c.price, 0) / comps.length;

  return (
    <div className="bg-slate-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">eBay Sold Comps</p>
        <p className="text-xs text-slate-500">{comps.length} result{comps.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Disclaimer + searched query */}
      <div className="space-y-0.5">
        <p className="flex items-center gap-1 text-[12px] text-slate-500">
          <Info className="w-3 h-3 shrink-0" />
          Comps are based on similar eBay listings. Verify the exact model matches your item.
        </p>
        {searchedQuery && (
          <p className="text-[11px] text-slate-600 italic pl-4">Searched: {searchedQuery}</p>
        )}
      </div>

      {/* Average price */}
      <div className="text-center py-2">
        <p className="text-xs text-slate-400 mb-1">Avg Sold Price</p>
        <p className="text-2xl font-bold text-amber-400">${avgPrice.toFixed(2)}</p>
      </div>

      {/* Comp cards */}
      <div className="space-y-2">
        {comps.map((comp, i) => {
          const match = getMatchQuality(itemName, comp.title);
          return (
            <div key={i} className="bg-slate-800 rounded-lg p-3 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate" title={comp.title}>
                  {comp.title.length > 50 ? comp.title.slice(0, 50) + '...' : comp.title}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{comp.condition}</span>
                  {match === 'close' ? (
                    <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">Close match</span>
                  ) : (
                    <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">Similar</span>
                  )}
                  {comp.soldDate && (
                    <span className="text-xs text-slate-500">
                      {new Date(comp.soldDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-green-400 font-semibold text-sm">${comp.price.toFixed(2)}</span>
                {comp.itemUrl && (
                  <a
                    href={comp.itemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-600 text-center">Powered by eBay</p>
    </div>
  );
}
