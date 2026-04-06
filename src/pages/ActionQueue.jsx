import React, { useState } from 'react';
import { CheckSquare, AlertCircle, Clock, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, items, marketplaceActions, marketplaceListings } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const PLATFORM_LABELS = {
  ebay: 'eBay', etsy: 'Etsy', poshmark: 'Poshmark', mercari: 'Mercari',
  depop: 'Depop', grailed: 'Grailed', facebook_marketplace: 'Facebook Marketplace', whatnot: 'Whatnot',
};

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-slate-100 text-slate-600 border-slate-200',
  low:      'bg-slate-50 text-slate-400 border-slate-100',
};

const GROUP_CONFIG = {
  publish:          { label: 'Needs Posting',    icon: CheckSquare, color: 'text-blue-600' },
  update:           { label: 'Needs Update',     icon: RefreshCw,   color: 'text-amber-600' },
  delist:           { label: 'Needs Delist',     icon: Trash2,      color: 'text-red-600' },
  confirm_posted:   { label: 'Confirm Posted',   icon: CheckSquare, color: 'text-emerald-600' },
  confirm_delisted: { label: 'Confirm Delisted', icon: CheckSquare, color: 'text-slate-500' },
  resolve_error:    { label: 'Errors',           icon: AlertCircle, color: 'text-red-600' },
};

function ActionCard({ action, item, onComplete, onSkip }) {
  const priorityCfg = PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.medium;
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    await onComplete(action);
    setCompleting(false);
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${action.priority === 'critical' ? 'border-red-200' : 'border-slate-100'} overflow-hidden`}>
      <div className="p-3">
        <div className="flex items-start gap-3">
          {item?.primary_photo_url && (
            <img src={item.primary_photo_url} className="w-14 h-14 rounded-lg object-cover shrink-0" alt={item.item_name} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-900 truncate">{item?.item_name || 'Unknown Item'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityCfg}`}>{action.priority}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{PLATFORM_LABELS[action.platform] || action.platform}</p>
            <p className="text-sm font-medium text-slate-800 mt-1">{action.action_title}</p>
          </div>
        </div>
        {action.action_instructions && (
          <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-2 leading-relaxed">{action.action_instructions}</p>
        )}
        <div className="flex gap-2 mt-3">
          {action.deep_link_url && (
            <a href={action.deep_link_url} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" variant="outline" className="w-full h-9 text-xs">
                <ExternalLink className="w-3 h-3 mr-1" />Open {PLATFORM_LABELS[action.platform] || action.platform}
              </Button>
            </a>
          )}
          <Button size="sm" onClick={handleComplete} disabled={completing} className="flex-1 h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white">
            {completing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Mark Complete'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onSkip(action)} className="h-9 text-xs text-slate-400 shrink-0">Skip</Button>
        </div>
      </div>
    </div>
  );
}

export default function ActionQueue() {
  const queryClient = useQueryClient();

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ['action-queue'],
    queryFn: async () => {
      const user = await auth.me();
      return marketplaceActions.getAll({ filters: { user_id: user.id, action_status: 'pending' }, orderBy: '-created_at', limit: 100 });
    },
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ['action-queue-items'],
    queryFn: async () => {
      const user = await auth.me();
      return items.getAll({ filters: { user_id: user.id }, orderBy: '-created_at', limit: 200 });
    },
  });

  const itemMap = Object.fromEntries(allItems.map(i => [i.id, i]));

  const grouped = Object.entries(GROUP_CONFIG).reduce((acc, [type]) => {
    acc[type] = actions.filter(a => a.action_type === type);
    return acc;
  }, {});

  const handleComplete = async (action) => {
    await marketplaceActions.update(action.id, {
      action_status: 'completed',
      completed_at: new Date().toISOString(),
    });
    if (action.action_type === 'delist' && action.marketplace_listing_id) {
      await marketplaceListings.update(action.marketplace_listing_id, { listing_status: 'delisted' });
    }
    if ((action.action_type === 'publish' || action.action_type === 'confirm_posted') && action.marketplace_listing_id) {
      await marketplaceListings.update(action.marketplace_listing_id, { listing_status: 'listed' });
    }
    toast.success('Action completed!');
    queryClient.invalidateQueries(['action-queue']);
  };

  const handleSkip = async (action) => {
    await marketplaceActions.update(action.id, { action_status: 'skipped' });
    toast('Action skipped');
    queryClient.invalidateQueries(['action-queue']);
  };

  const totalPending = actions.length;
  const criticalCount = actions.filter(a => a.priority === 'critical').length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <CheckSquare className="w-7 h-7 text-amber-400" />
          <h1 className="text-2xl font-bold">Action Queue</h1>
          {totalPending > 0 && (
            <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{totalPending}</span>
          )}
        </div>
        <p className="text-slate-400 text-sm">
          {criticalCount > 0 ? `⚠️ ${criticalCount} critical action${criticalCount > 1 ? 's' : ''} need attention` : 'Your crosslisting tasks'}
        </p>
      </div>

      <div className="p-4 space-y-5">
        {actionsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : totalPending === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm">
            <CheckSquare className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">All caught up!</p>
            <p className="text-xs text-slate-400 mt-1">No pending actions right now</p>
          </div>
        ) : (
          Object.entries(GROUP_CONFIG).map(([type, cfg]) => {
            const group = grouped[type] || [];
            if (group.length === 0) return null;
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div className={`flex items-center gap-2 mb-2 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <span className="text-xs text-slate-400 font-normal">({group.length})</span>
                </div>
                <div className="space-y-2">
                  {group.map(action => (
                    <ActionCard key={action.id} action={action} item={itemMap[action.item_id]} onComplete={handleComplete} onSkip={handleSkip} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
