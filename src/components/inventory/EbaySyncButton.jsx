import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function EbaySyncButton({ onSynced }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncEbayListings', {});
      toast.success(res.data?.message || 'eBay listings synced');
      onSynced?.();
    } catch (err) {
      const msg = err?.response?.data?.error || 'eBay sync failed';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={syncing}
      size="sm"
      variant="outline"
      className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white mb-3 w-full"
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing eBay Listings...' : 'Sync eBay Listings'}
    </Button>
  );
}