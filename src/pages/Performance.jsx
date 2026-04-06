import React, { useState } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, BarChart2, Calendar } from 'lucide-react';
import SalesTrendChart from '@/components/performance/SalesTrendChart';
import PlatformBreakdown from '@/components/performance/PlatformBreakdown';
import TopItems from '@/components/performance/TopItems';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

function MetricCard({ icon: Icon, label, value, sub, color = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-4">
      <div className="bg-slate-100 rounded-lg p-2.5 shrink-0">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function getDateRange(range, customStart, customEnd) {
  const now = new Date();
  if (range === '30d') {
    const start = new Date(now); start.setDate(now.getDate() - 30);
    return { start, end: now };
  }
  if (range === '3m') {
    const start = new Date(now); start.setMonth(now.getMonth() - 3);
    return { start, end: now };
  }
  if (range === '1y') {
    const start = new Date(now); start.setFullYear(now.getFullYear() - 1);
    return { start, end: now };
  }
  if (range === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart), end: new Date(customEnd) };
  }
  return null; // all time
}

export default function Performance() {
  const [range, setRange] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = getDateRange(range, customStart, customEnd);

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['perf-items'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Item.filter({ user_id: user.id }, '-created_date', 500);
    }
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['perf-sales'],
    queryFn: () => base44.entities.Sale.list('-sold_date', 500)
  });

  const isLoading = itemsLoading || salesLoading;

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const allPlatforms = [...new Set(sales.map(s => s.platform).filter(Boolean))];
  const allCategories = [...new Set(items.map(i => i.category).filter(Boolean))];

  // Filter sales by date range + platform + category
  const filteredSales = sales.filter(s => {
    if (dateRange) {
      if (!s.sold_date) return false;
      const d = new Date(s.sold_date);
      if (d < dateRange.start || d > dateRange.end) return false;
    }
    if (filterPlatform !== 'all' && s.platform !== filterPlatform) return false;
    if (filterCategory !== 'all') {
      const item = itemMap[s.item_id];
      if (!item || item.category !== filterCategory) return false;
    }
    return true;
  });

  // Active items (investment = all active, not date-filtered)
  const activeItems = items.filter(i => i.status !== 'archived');
  const totalInvestment = activeItems.reduce((sum, i) => sum + (i.purchase_price || 0), 0);

  // From sales: revenue, fees, shipping, net profit
  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
  const totalFees = filteredSales.reduce((sum, s) => sum + (s.fees || 0), 0);
  const totalShipping = filteredSales.reduce((sum, s) => sum + (s.shipping_cost || 0), 0);

  // Net profit: use stored net_profit if available, else calculate
  const totalNetProfit = filteredSales.reduce((sum, s) => {
    if (s.net_profit != null) return sum + s.net_profit;
    const item = itemMap[s.item_id];
    const cost = item?.purchase_price || 0;
    return sum + (s.sold_price || 0) - cost - (s.fees || 0) - (s.shipping_cost || 0);
  }, 0);

  // Total cost of sold items
  const totalCostOfSoldItems = filteredSales.reduce((sum, s) => {
    const item = itemMap[s.item_id];
    return sum + (item?.purchase_price || 0);
  }, 0);

  const roi = totalCostOfSoldItems > 0
    ? ((totalNetProfit / totalCostOfSoldItems) * 100).toFixed(1)
    : null;

  const avgProfitPerSale = filteredSales.length > 0
    ? (totalNetProfit / filteredSales.length).toFixed(2)
    : 0;

  const fmt = (n) => `$${Math.abs(n).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-emerald-400" />
          <h1 className="text-2xl font-bold">Performance</h1>
        </div>
        <p className="text-slate-400 text-sm mt-1">Profit, investment & ROI overview</p>
      </div>

      {/* Time Frame Selector */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600 font-medium">Time Frame</span>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="3m">Last 3 Months</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-slate-500 mb-1">Start Date</Label>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1">End Date</Label>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        )}
        {/* Platform & Category filters */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {allPlatforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <MetricCard
              icon={DollarSign}
              label="Net Profit"
              value={`${totalNetProfit < 0 ? '-' : '+'}${fmt(totalNetProfit)}`}
              sub={`From ${filteredSales.length} sale${filteredSales.length !== 1 ? 's' : ''}`}
              color={totalNetProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <MetricCard
              icon={ShoppingBag}
              label="Total Investment"
              value={fmt(totalInvestment)}
              sub={`Across ${activeItems.length} active item${activeItems.length !== 1 ? 's' : ''}`}
            />
            <MetricCard
              icon={BarChart2}
              label="Return on Investment (ROI)"
              value={roi !== null ? `${roi}%` : 'N/A'}
              sub="Based on cost of sold items"
              color={roi !== null && parseFloat(roi) >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <MetricCard
              icon={TrendingUp}
              label="Avg Profit per Sale"
              value={`${parseFloat(avgProfitPerSale) >= 0 ? '+' : '-'}$${Math.abs(avgProfitPerSale)}`}
              color={parseFloat(avgProfitPerSale) >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />

            {/* Sales Trend */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sales Trend</p>
              <div className="text-xs text-slate-400 flex gap-4 mb-2">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-500 inline-block"/>Revenue</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block"/>Profit</span>
              </div>
              <SalesTrendChart sales={filteredSales} />
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-xl p-4 shadow-sm mt-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sales Breakdown</p>
              <div className="space-y-2">
                {[
                  { label: 'Total Revenue', value: fmt(totalRevenue) },
                  { label: 'Total Fees', value: `- ${fmt(totalFees)}` },
                  { label: 'Total Shipping', value: `- ${fmt(totalShipping)}` },
                  { label: 'Cost of Sold Items', value: `- ${fmt(totalCostOfSoldItems)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-800">{value}</span>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-slate-700">Net Profit</span>
                  <span className={totalNetProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                    {totalNetProfit >= 0 ? '+' : '-'}{fmt(totalNetProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Platform & Category breakdown */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">By Platform & Category</p>
              <PlatformBreakdown sales={filteredSales} items={items} />
            </div>

            {/* Top Items */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Top Items by Profit</p>
              <TopItems sales={filteredSales} items={items} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}