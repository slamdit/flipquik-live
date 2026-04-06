import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DollarSign, TrendingUp, Package, BarChart2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Sales() {
  const [syncing, setSyncing] = useState(false);

  const handleEbaySync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncEbaySales', {});
      toast.success(res.data?.message || 'Sync complete');
      refetchSales();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'eBay sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const { data: sales = [], isLoading: salesLoading, refetch: refetchSales } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sold_date', 200)
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items-sold'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Item.filter({ user_id: user.id, status: 'sold' }, '-updated_at', 200);
    }
  });

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  const totalRevenue = sales.reduce((s, x) => s + (x.sold_price || 0), 0);
  const totalFees = sales.reduce((s, x) => s + (x.fees || 0), 0);
  const totalProfit = sales.reduce((s, x) => s + (x.net_profit || 0), 0);
  const avgROI = sales.filter(x => x.roi_percent != null).length > 0
    ? sales.filter(x => x.roi_percent != null).reduce((s, x) => s + x.roi_percent, 0) / sales.filter(x => x.roi_percent != null).length
    : null;

  const platformCounts = sales.reduce((acc, x) => {
    if (x.platform) acc[x.platform] = (acc[x.platform] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Sales</h1>
          <span className="ml-auto text-slate-400 text-sm">{sales.length} sold</span>
        </div>
        <div className="mt-3">
          <Button
            onClick={handleEbaySync}
            disabled={syncing}
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing eBay...' : 'Sync eBay Sales'}
          </Button>
        </div>
      </div>

      {salesLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Package className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No sales yet</p>
          <p className="text-slate-400 text-sm mt-1">Mark items as sold from Inventory to track profit here.</p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-slate-900">${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Total Profit</p>
              <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Total Fees</p>
              <p className="text-xl font-bold text-slate-700">${totalFees.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Avg ROI</p>
              <p className={`text-xl font-bold ${avgROI != null && avgROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {avgROI != null ? `${avgROI.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Platform breakdown */}
          {Object.keys(platformCounts).length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700">By Platform</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(platformCounts).map(([platform, count]) => (
                  <span key={platform} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                    {platform} · {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sales list */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent Sales</p>
            <div className="space-y-2">
              {sales.map(sale => {
                const item = itemMap[sale.item_id];
                return (
                  <div key={sale.id} className="bg-white rounded-xl shadow-sm flex items-center gap-3 p-3">
                    {item?.primary_photo_url ? (
                      <img src={item.primary_photo_url} alt={item.item_name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-slate-300" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">{item?.item_name || 'Unknown item'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {sale.platform && (
                          <span className="text-xs text-slate-400">{sale.platform}</span>
                        )}
                        {sale.sold_date && (
                          <span className="text-xs text-slate-400">{sale.sold_date}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500">Sold: <span className="font-medium text-slate-700">${sale.sold_price?.toFixed(2)}</span></span>
                        {sale.fees > 0 && (
                          <span className="text-xs text-slate-400">Fees: ${sale.fees?.toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={`text-base font-bold ${sale.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {sale.net_profit >= 0 ? '+' : ''}${sale.net_profit?.toFixed(2)}
                      </p>
                      {sale.roi_percent != null && (
                        <p className={`text-xs font-medium ${sale.roi_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {sale.roi_percent >= 0 ? '+' : ''}{sale.roi_percent.toFixed(1)}% ROI
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}