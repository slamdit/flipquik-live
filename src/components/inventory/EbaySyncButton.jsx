import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import supabase from '@/lib/supabase';
import { toast } from 'sonner';

export default function EbaySyncButton({ onSynced }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('syncEbayListings', { body: {} });
      if (error) throw error;
      toast.success(data?.message || 'eBay listings synced');
      onSynced?.();
    } catch (err) {
      toast.error(err?.message || 'eBay sync failed');
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
