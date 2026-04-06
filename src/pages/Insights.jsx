import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function Insights() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-7 h-7 text-slate-800" />
          <h1 className="text-2xl font-bold text-slate-900">Insights</h1>
        </div>
        
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-slate-600">Insights content coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}