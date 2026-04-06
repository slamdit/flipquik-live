import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DollarSign, X } from 'lucide-react';

export default function SaleModal({ item, onClose, onSuccess }) {
  const [soldPrice, setSoldPrice] = useState('');
  const [platform, setPlatform] = useState('');
  const [fees, setFees] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const purchasePrice = item.purchase_price || 0;
  const soldPriceNum = parseFloat(soldPrice) || 0;
  const feesNum = parseFloat(fees) || 0;
  const netProfit = soldPriceNum - feesNum - purchasePrice;

  const handleSave = async () => {
    if (!soldPrice || soldPriceNum <= 0) {
      toast.error('Enter a valid sale price');
      return;
    }
    setSaving(true);
    try {
      const roi = purchasePrice > 0 ? Math.round((netProfit / purchasePrice) * 100 * 100) / 100 : null;

      await base44.entities.Sale.create({
        item_id: item.id,
        platform: platform.trim() || undefined,
        sold_price: soldPriceNum,
        fees: feesNum || undefined,
        net_profit: Math.round(netProfit * 100) / 100,
        roi_percent: roi ?? undefined,
        notes: notes.trim() || undefined,
        sold_date: new Date().toISOString().split('T')[0]
      });

      await base44.entities.Item.update(item.id, {
        status: 'sold',
        updated_at: new Date().toISOString()
      });

      toast.success('Sale recorded!');
      onSuccess();
    } catch (e) {
      toast.error('Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-slate-900">Record Sale</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
          <span className="font-medium text-slate-700">{item.item_name}</span>
          {purchasePrice > 0 && <span className="ml-2">· Cost: ${purchasePrice.toFixed(2)}</span>}
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sold-price">Sale Price *</Label>
            <Input
              id="sold-price"
              type="number"
              step="0.01"
              value={soldPrice}
              onChange={e => setSoldPrice(e.target.value)}
              placeholder="0.00"
              className="h-11 mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="platform">Platform</Label>
            <Input
              id="platform"
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              placeholder="eBay, Poshmark, Mercari..."
              className="h-11 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="fees">Fees (optional)</Label>
            <Input
              id="fees"
              type="number"
              step="0.01"
              value={fees}
              onChange={e => setFees(e.target.value)}
              placeholder="0.00"
              className="h-11 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="sale-notes">Notes (optional)</Label>
            <Input
              id="sale-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Buyer info, special details..."
              className="h-11 mt-1"
            />
          </div>
        </div>

        {soldPriceNum > 0 && (
          <div className={`rounded-xl p-3 text-sm font-medium text-center ${netProfit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <DollarSign className="w-4 h-4 inline mr-1" />
            Net Profit: {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Mark as Sold'}
          </Button>
        </div>
      </div>
    </div>
  );
}