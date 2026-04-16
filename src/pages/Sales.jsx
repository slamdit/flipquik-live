import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DollarSign, TrendingUp, Package, Hash, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const PLATFORM_COLORS = {
  'eBay':                   'bg-yellow-100 text-yellow-800',
  'Poshmark':               'bg-red-100 text-red-700',
  'Mercari':                'bg-blue-100 text-blue-700',
  'Facebook Marketplace':   'bg-blue-100 text-blue-800',
  'Etsy':                   'bg-orange-100 text-orange-700',
  'Depop':                  'bg-pink-100 text-pink-700',
  'Other':                  'bg-slate-100 text-slate-600',
};

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Fetch sales joined with items ───────────────────────────────
async function fetchSalesWithItems() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not signed in');

  const { data: salesData, error: salesErr } = await supabase
    .from('sales')
    .select('*')
    .eq('user_id', session.user.id)
    .order('sold_date', { ascending: false })
    .limit(500);
  if (salesErr) throw salesErr;

  const itemIds = [...new Set((salesData || []).map(s => s.item_id).filter(Boolean))];
  let itemMap = {};
  if (itemIds.length > 0) {
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name, brand, category, cost, primary_photo_url, created_at')
      .in('id', itemIds);
    if (itemsData) itemMap = Object.fromEntries(itemsData.map(i => [i.id, i]));
  }

  return { sales: salesData || [], itemMap };
}

// ── Summary Card ────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-xl p-3.5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-slate-400" />
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ── Sale Card ───────────────────────────────────────────────────
function SaleCard({ sale, item }) {
  const itemName = item?.name || 'Unknown item';
  const cost = item?.cost ?? 0;
  const profit = sale.net_profit ?? 0;

  return (
    <div className="bg-white rounded-xl shadow-sm flex items-center gap-3 p-3">
      {item?.primary_photo_url ? (
        <img src={item.primary_photo_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-slate-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-slate-900 truncate">{itemName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {sale.platform && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[sale.platform] || PLATFORM_COLORS.Other}`}>
              {sale.platform}
            </span>
          )}
          <span className="text-xs text-slate-400">{formatDate(sale.sold_date)}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className="text-slate-500">Sold: <span className="font-medium text-slate-700">${(sale.sold_price || 0).toFixed(2)}</span></span>
          {cost > 0 && <span className="text-slate-400">Cost: ${cost.toFixed(2)}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-base font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
        </p>
        <p className="text-[10px] text-slate-400">profit</p>
      </div>
    </div>
  );
}

// ── Main Sales Page ─────────────────────────────────────────────
export default function Sales() {
  const [sortBy, setSortBy] = useState('date');
  const [filterPlatform, setFilterPlatform] = useState('__all__');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-with-items'],
    queryFn: fetchSalesWithItems,
  });

  const allSales = data?.sales || [];
  const itemMap = data?.itemMap || {};

  const platforms = useMemo(() =>
    [...new Set(allSales.map(s => s.platform).filter(Boolean))].sort(),
    [allSales]
  );

  const filtered = useMemo(() => {
    let out = allSales;

    if (filterPlatform !== '__all__') {
      out = out.filter(s => s.platform === filterPlatform);
    }
    if (dateFrom) {
      out = out.filter(s => s.sold_date && s.sold_date >= dateFrom);
    }
    if (dateTo) {
      out = out.filter(s => s.sold_date && s.sold_date <= dateTo);
    }
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(s => {
        const item = itemMap[s.item_id];
        return item?.name?.toLowerCase().includes(q) ||
               item?.brand?.toLowerCase().includes(q) ||
               s.platform?.toLowerCase().includes(q);
      });
    }

    return [...out].sort((a, b) => {
      switch (sortBy) {
        case 'profit': return (b.net_profit || 0) - (a.net_profit || 0);
        case 'price':  return (b.sold_price || 0) - (a.sold_price || 0);
        case 'platform': return (a.platform || '').localeCompare(b.platform || '');
        case 'date':
        default: return new Date(b.sold_date || 0) - new Date(a.sold_date || 0);
      }
    });
  }, [allSales, itemMap, filterPlatform, dateFrom, dateTo, search, sortBy]);

  const totalSales = filtered.reduce((s, x) => s + (x.sold_price || 0), 0);
  const totalProfit = filtered.reduce((s, x) => s + (x.net_profit || 0), 0);
  const avgProfit = filtered.length > 0 ? totalProfit / filtered.length : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Sales</h1>
          <span className="ml-auto text-slate-400 text-sm">{filtered.length} sale{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard icon={DollarSign} label="Total Sales" value={`$${totalSales.toFixed(2)}`} />
            <SummaryCard
              icon={TrendingUp}
              label="Total Profit"
              value={`${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`}
              color={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}
            />
            <SummaryCard
              icon={TrendingUp}
              label="Avg Profit / Item"
              value={`${avgProfit >= 0 ? '+' : ''}$${avgProfit.toFixed(2)}`}
              color={avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}
            />
            <SummaryCard icon={Hash} label="Items Sold" value={filtered.length} />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sales..."
              className="pl-9 pr-9 h-10 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort + Filter row */}
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date (Newest)</SelectItem>
                <SelectItem value="profit">Profit (Highest)</SelectItem>
                <SelectItem value="price">Sale Price</SelectItem>
                <SelectItem value="platform">Platform</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Platforms</SelectItem>
                {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-slate-500">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm mt-0.5" />
            </div>
          </div>

          {/* Sale cards */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No sales found</p>
              <p className="text-xs text-slate-400 mt-1">Mark items as Flipped from Inventory to track sales here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(sale => (
                <SaleCard key={sale.id} sale={sale} item={itemMap[sale.item_id]} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
