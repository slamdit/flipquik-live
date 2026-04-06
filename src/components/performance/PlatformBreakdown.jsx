import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];

export default function PlatformBreakdown({ sales, items }) {
  // By platform
  const byPlatform = {};
  for (const s of sales) {
    const p = s.platform || 'Unknown';
    if (!byPlatform[p]) byPlatform[p] = { platform: p, revenue: 0, profit: 0, count: 0 };
    byPlatform[p].revenue += s.sold_price || 0;
    byPlatform[p].profit += s.net_profit || 0;
    byPlatform[p].count += 1;
  }

  // By category
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const byCategory = {};
  for (const s of sales) {
    const item = itemMap[s.item_id];
    const cat = item?.category || 'Uncategorized';
    if (!byCategory[cat]) byCategory[cat] = { category: cat, revenue: 0, profit: 0, count: 0 };
    byCategory[cat].revenue += s.sold_price || 0;
    byCategory[cat].profit += s.net_profit || 0;
    byCategory[cat].count += 1;
  }

  const platformData = Object.values(byPlatform).sort((a, b) => b.revenue - a.revenue);
  const categoryData = Object.values(byCategory).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  return (
    <div className="space-y-4">
      {platformData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">By Platform</p>
          <div className="space-y-2">
            {platformData.map((p, i) => (
              <div key={p.platform} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-slate-600 w-24 truncate">{p.platform}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-slate-700"
                    style={{ width: `${(p.revenue / Math.max(...platformData.map(x => x.revenue))) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700 w-16 text-right">${p.revenue.toFixed(0)}</span>
                <span className={`text-xs w-16 text-right ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(0)} profit
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {categoryData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">By Category</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={categoryData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(val) => [`$${val.toFixed(2)}`]}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}