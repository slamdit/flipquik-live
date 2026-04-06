import React from 'react';
import { Package } from 'lucide-react';

export default function TopItems({ sales, items }) {
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  const byItem = {};
  for (const s of sales) {
    const key = s.item_id;
    if (!key) continue;
    if (!byItem[key]) byItem[key] = { item_id: key, revenue: 0, profit: 0, count: 0 };
    byItem[key].revenue += s.sold_price || 0;
    byItem[key].profit += s.net_profit || 0;
    byItem[key].count += 1;
  }

  const top = Object.values(byItem)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  if (top.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">No data yet</p>;
  }

  return (
    <div className="space-y-2">
      {top.map((entry, i) => {
        const item = itemMap[entry.item_id];
        return (
          <div key={entry.item_id} className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 w-4">#{i + 1}</span>
            {item?.primary_photo_url ? (
              <img src={item.primary_photo_url} className="w-10 h-10 rounded-lg object-cover shrink-0" alt={item.item_name} />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-slate-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item?.item_name || 'Unknown Item'}</p>
              <p className="text-xs text-slate-400">${entry.revenue.toFixed(2)} revenue · {entry.count} sold</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold ${entry.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {entry.profit >= 0 ? '+' : ''}${entry.profit.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">profit</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}