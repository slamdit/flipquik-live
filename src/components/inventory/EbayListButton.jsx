import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function EbayListButton({ item, onListed }) {
  const [showForm, setShowForm] = useState(false);
  const [price, setPrice] = useState(item.suggested_price || item.purchase_price || '');
  const [listing, setListing] = useState(false);

  const handleList = async () => {
    if (!price || parseFloat(price) <= 0) { toast.error('Enter a valid price'); return; }
    setListing(true);
    try {
      const res = await base44.functions.invoke('publishToEbay', { item_id: item.id, price: parseFloat(price) });
      const data = res?.data;
      console.log('[EbayListButton] publishToEbay response:', data);
      if (!data?.success) {
        const errMsg = data?.error || (data?.step ? `Failed at step: ${data.step}` : 'Unknown error');
        toast.error('eBay error: ' + errMsg);
        return;
      }
      toast.success('Listed on eBay!');
      setShowForm(false);
      onListed?.();
    } catch (e) {
      const errDetail = e?.response?.data?.error || e?.response?.data?.step || e.message || 'unknown error';
      console.error('[EbayListButton] publishToEbay error:', e?.response?.data || e.message);
      toast.error('eBay listing failed: ' + errDetail);
    } finally {
      setListing(false);
    }
  };

  if (!showForm) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowForm(true)}
        className="h-9 text-xs border-yellow-300 text-yellow-700 hover:bg-yellow-50"
      >
        <ShoppingCart className="w-3 h-3 mr-1" />
        List on eBay
      </Button>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-yellow-800">List on eBay</p>
      <div>
        <Label className="text-xs text-slate-600">Listing Price ($)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={e => setPrice(e.target.value)}
          className="h-9 mt-1 text-sm"
          placeholder="0.00"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1 h-9 text-xs">Cancel</Button>
        <Button
          size="sm"
          onClick={handleList}
          disabled={listing}
          className="flex-1 h-9 text-xs bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          {listing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Publish to eBay'}
        </Button>
      </div>
    </div>
  );
}