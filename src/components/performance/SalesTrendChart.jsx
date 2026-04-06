import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

export default function SalesTrendChart({ sales }) {
  // Group by week
  const byWeek = {};
  for (const s of sales) {
    if (!s.sold_date) continue;
    const d = parseISO(s.sold_date);
    const weekKey = format(d, 'MMM d');
    if (!byWeek[weekKey]) byWeek[weekKey] = { date: weekKey, revenue: 0, profit: 0, count: 0 };
    byWeek[weekKey].revenue += s.sold_price || 0;
    byWeek[weekKey].profit += s.net_profit || 0;
    byWeek[weekKey].count += 1;
  }

  const data = Object.values(byWeek).slice(-20);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        No sales data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(val, name) => [`$${val.toFixed(2)}`, name === 'revenue' ? 'Revenue' : 'Profit']}
        />
        <Line type="monotone" dataKey="revenue" stroke="#64748b" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}