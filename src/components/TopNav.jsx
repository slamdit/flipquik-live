import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, DollarSign, Zap, Settings, TrendingUp, Layers, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/Dashboard', icon: LayoutDashboard, label: 'Home' },
  { path: '/QuikEval', icon: Zap, label: 'QuikEval' },
  { path: '/MultiEval', icon: Layers, label: 'MultiEval' },
  { path: '/flip-it', icon: Tag, label: 'Flip It' },
  { path: '/Inventory', icon: Package, label: 'Inventory' },
  { path: '/Sales', icon: DollarSign, label: 'Sales' },
  { path: '/Performance', icon: TrendingUp, label: 'Performance' },
];

export default function TopNav() {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-50">
      <div className="flex items-center justify-between px-3 h-12">
        <Link to="/Dashboard" className="text-lg font-bold text-slate-900 shrink-0">FlipQuik</Link>
        <Link to="/Settings" className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 shrink-0">
          <Settings className="w-5 h-5" />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}