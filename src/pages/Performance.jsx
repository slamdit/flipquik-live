import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Clock, Award, BarChart2, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];

function MetricCard({ icon: Icon, label, value, sub, color = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-slate-400" />
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

async function fetchPerformanceData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not signed in');

  const { data: salesData } = await supabase
    .from('sales')
    .select('*')
    .eq('user_id', session.user.id)
    .order('sold_date', { ascending: true })
    .limit(500);

  const itemIds = [...new Set((salesData || []).map(s => s.item_id).filter(Boolean))];
  let itemMap = {};
  if (itemIds.length > 0) {
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name, brand, category, cost, created_at')
      .in('id', itemIds);
    if (itemsData) itemMap = Object.fromEntries(itemsData.map(i => [i.id, i]));
  }

  return { sales: salesData || [], itemMap };
}

function getDateCutoff(range) {
  const now = new Date();
  if (range === '7d')  return new Date(now.getTime() - 7  * 86400000);
  if (range === '30d') return new Date(now.getTime() - 30 * 86400000);
  if (range === '90d') return new Date(now.getTime() - 90 * 86400000);
  return null;
}

export default function Performance() {
  const [range, setRange] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['perf-data'],
    queryFn: fetchPerformanceData,
  });

  const allSales = data?.sales || [];
  const itemMap = data?.itemMap || {};

  const cutoff = getDateCutoff(range);
  const filtered = useMemo(() => {
    if (!cutoff) return allSales;
    return allSales.filter(s => s.sold_date && new Date(s.sold_date) >= cutoff);
  }, [allSales, range]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPIs ──────────────────────────────────────────────────────
  const totalRevenue = filtered.reduce((s, x) => s + (x.sold_price || 0), 0);
  const totalProfit = filtered.reduce((s, x) => s + (x.net_profit || 0), 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

  const daysToSell = filtered.map(s => {
    const item = itemMap[s.item_id];
    if (!item?.created_at || !s.sold_date) return null;
    return differenceInDays(parseISO(s.sold_date), parseISO(item.created_at));
  }).filter(d => d != null && d >= 0);
  const avgDaysToSell = daysToSell.length > 0
    ? Math.round(daysToSell.reduce((a, b) => a + b, 0) / daysToSell.length)
    : null;

  // Best category by profit
  const catProfits = {};
  for (const s of filtered) {
    const cat = itemMap[s.item_id]?.category || 'Uncategorized';
    catProfits[cat] = (catProfits[cat] || 0) + (s.net_profit || 0);
  }
  const bestCategory = Object.entries(catProfits).sort((a, b) => b[1] - a[1])[0];

  // Best platform by profit
  const platProfits = {};
  for (const s of filtered) {
    const p = s.platform || 'Unknown';
    platProfits[p] = (platProfits[p] || 0) + (s.net_profit || 0);
  }
  const bestPlatform = Object.entries(platProfits).sort((a, b) => b[1] - a[1])[0];

  // ── Chart 1: Monthly Profit (Bar) ─────────────────────────────
  const monthlyData = useMemo(() => {
    const byMonth = {};
    for (const s of filtered) {
      if (!s.sold_date) continue;
      const key = format(parseISO(s.sold_date), 'MMM yyyy');
      if (!byMonth[key]) byMonth[key] = { month: key, revenue: 0, profit: 0 };
      byMonth[key].revenue += s.sold_price || 0;
      byMonth[key].profit += s.net_profit || 0;
    }
    return Object.values(byMonth);
  }, [filtered]);

  // ── Chart 2: Sales by Platform (Pie) ──────────────────────────
  const platformData = useMemo(() => {
    const byPlat = {};
    for (const s of filtered) {
      const p = s.platform || 'Unknown';
      if (!byPlat[p]) byPlat[p] = { name: p, value: 0, count: 0 };
      byPlat[p].value += s.sold_price || 0;
      byPlat[p].count += 1;
    }
    return Object.values(byPlat).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // ── Chart 3: Profit Margin Trend (Line) ───────────────────────
  const marginData = useMemo(() => {
    const byMonth = {};
    for (const s of filtered) {
      if (!s.sold_date) continue;
      const key = format(parseISO(s.sold_date), 'MMM yyyy');
      if (!byMonth[key]) byMonth[key] = { month: key, revenue: 0, profit: 0 };
      byMonth[key].revenue += s.sold_price || 0;
      byMonth[key].profit += s.net_profit || 0;
    }
    return Object.values(byMonth).map(m => ({
      month: m.month,
      margin: m.revenue > 0 ? Math.round(m.profit / m.revenue * 100) : 0,
    }));
  }, [filtered]);

  const fmt = (n) => `$${Math.abs(n).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-emerald-400" />
          <h1 className="text-2xl font-bold">Performance</h1>
        </div>
        <p className="text-slate-400 text-sm mt-1">Revenue, profit & trends</p>
      </div>

      {/* Date range filter */}
      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <BarChart2 className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No sales data yet</p>
          <p className="text-slate-400 text-sm mt-1">Mark items as Flipped to see performance data.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={DollarSign}
              label="Total Revenue"
              value={fmt(totalRevenue)}
              sub={`${filtered.length} sale${filtered.length !== 1 ? 's' : ''}`}
            />
            <MetricCard
              icon={TrendingUp}
              label="Total Profit"
              value={`${totalProfit >= 0 ? '+' : '-'}${fmt(totalProfit)}`}
              color={totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <MetricCard
              icon={BarChart2}
              label="Profit Margin"
              value={`${profitMargin.toFixed(1)}%`}
              color={profitMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <MetricCard
              icon={Clock}
              label="Avg Days to Sell"
              value={avgDaysToSell != null ? `${avgDaysToSell}d` : '—'}
            />
            <MetricCard
              icon={Award}
              label="Best Category"
              value={bestCategory ? bestCategory[0] : '—'}
              sub={bestCategory ? `+${fmt(bestCategory[1])} profit` : undefined}
              color="text-slate-900"
            />
            <MetricCard
              icon={Award}
              label="Best Platform"
              value={bestPlatform ? bestPlatform[0] : '—'}
              sub={bestPlatform ? `+${fmt(bestPlatform[1])} profit` : undefined}
              color="text-slate-900"
            />
          </div>

          {/* Chart 1: Monthly Profit (Bar) */}
          {monthlyData.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Monthly Profit</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(val) => [`$${val.toFixed(2)}`]}
                  />
                  <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry, i) => (
                      <Cell key={i} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Chart 2: Sales by Platform (Pie) */}
          {platformData.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sales by Platform</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {platformData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(val, name) => [`$${val.toFixed(2)}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {platformData.map((p, i) => (
                  <span key={p.name} className="flex items-center gap-1 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {p.name} ({p.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chart 3: Profit Margin Trend (Line) */}
          {marginData.length > 1 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Profit Margin Trend</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={marginData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(val) => [`${val}%`, 'Margin']}
                  />
                  <Line type="monotone" dataKey="margin" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
