import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { auth, items, sales } from '@/lib/supabase';
import { FileText, Package, Tag, DollarSign, TrendingUp, Zap, Settings } from 'lucide-react';
import { toast } from 'sonner';

function StatCard({ icon: Icon, label, value, sublabel, to, accent }) {
  const content = (
    <div className={`bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 ${to ? 'active:scale-95 transition-transform' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-none">{value ?? '—'}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('status') === 'success') {
      toast.success('Subscription activated! Welcome aboard.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['dashboard-items'],
    queryFn: async () => {
      const user = await auth.me();
      return items.getAll({ filters: { user_id: user.id }, orderBy: '-updated_at', limit: 500 });
    }
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ['dashboard-sales'],
    queryFn: () => sales.getAll({ orderBy: '-sold_date', limit: 200 })
  });

  const clippedCount = allItems.filter(i => i.status === 'clipped').length;
  const listedCount = allItems.filter(i => i.status === 'listed').length;
  const soldCount = allSales.length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSales = allSales.filter(s => s.sold_date && new Date(s.sold_date) >= sevenDaysAgo);
  const recentProfit = recentSales.reduce((sum, s) => sum + (s.net_profit || 0), 0);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-900 text-white px-4 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{greeting}</p>
            <h1 className="text-2xl font-bold mt-0.5">FlipQuik</h1>
          </div>
          <Link to="/Settings" className="p-2 rounded-xl hover:bg-slate-800 transition-colors">
            <Settings className="w-5 h-5 text-slate-400" />
          </Link>
        </div>
        {!isLoading && (
          <p className="text-slate-400 text-sm mt-1">{allItems.length} items in inventory</p>
        )}
        <Link
          to="/QuikEval"
          className="mt-4 flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 transition-transform text-white font-semibold text-base"
        >
          <Zap className="w-5 h-5" />
          QuikEval
        </Link>
      </div>

      <div className="px-4 pt-4 space-y-5">
       <div>
         <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Listing Workflow</p>
         <div className="grid grid-cols-3 gap-3">
           <StatCard
             icon={FileText}
             label="Clipped"
             value={clippedCount}
             to="/Inventory"
             accent="bg-blue-50 text-blue-600"
           />
           <StatCard
             icon={Tag}
             label="Listed"
             value={listedCount}
             to="/Inventory"
             accent="bg-orange-50 text-orange-600"
           />
           <StatCard
             icon={DollarSign}
             label="Sold"
             value={soldCount}
             to="/Sales"
             accent="bg-emerald-50 text-emerald-600"
           />
         </div>
       </div>

        <div className={`rounded-xl p-4 shadow-sm ${recentProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" />
            <p className="text-sm font-medium opacity-90">Profit — Last 7 Days</p>
          </div>
          <p className="text-3xl font-bold">
            {recentProfit >= 0 ? '+' : ''}${recentProfit.toFixed(2)}
          </p>
          {recentSales.length > 0 && (
            <p className="text-sm opacity-75 mt-0.5">from {recentSales.length} sale{recentSales.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>
    </div>
  );
}
