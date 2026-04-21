import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { DollarSign, X, PartyPopper } from 'lucide-react';

const PLATFORMS = [
  'eBay',
  'Poshmark',
  'Mercari',
  'Facebook Marketplace',
  'Etsy',
  'Depop',
  'Other',
];

function fireConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieces = Array.from({ length: 120 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 200,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 18 - 4,
    w: Math.random() * 8 + 4,
    h: Math.random() * 6 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    rv: (Math.random() - 0.5) * 0.3,
  }));
  let frame = 0;
  const maxFrames = 90;
  function draw() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.vy += 0.35;
      p.y += p.vy;
      p.rot += p.rv;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (frame < maxFrames) requestAnimationFrame(draw);
    else canvas.remove();
  }
  requestAnimationFrame(draw);
}

export default function SaleModal({ item, onClose, onSuccess }) {
  const [platform, setPlatform] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [platformFees, setPlatformFees] = useState('0');
  const [otherCosts, setOtherCosts] = useState('0');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const itemName = item.name || item.item_name || 'Untitled';
  const purchasePrice = item.cost ?? item.purchase_price ?? 0;
  const salePriceNum = parseFloat(salePrice) || 0;
  const shippingNum = parseFloat(shippingCost) || 0;
  const feesNum = parseFloat(platformFees) || 0;
  const otherNum = parseFloat(otherCosts) || 0;
  const netProfit = salePriceNum - purchasePrice - shippingNum - feesNum - otherNum;

  const handleSubmit = async () => {
    if (!salePrice || salePriceNum <= 0) {
      toast.error('Enter a valid sale price');
      return;
    }
    if (!platform) {
      toast.error('Select a platform');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not signed in');

      // Insert sale record
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          item_id: item.id,
          user_id: session.user.id,
          sold_price: salePriceNum,
          shipping_cost: shippingNum,
          platform_fees: feesNum,
          other_costs: otherNum,
          platform: platform,
          sold_date: new Date().toISOString().split('T')[0],
          internal_notes: internalNotes.trim() || null,
          net_profit: Math.round(netProfit * 100) / 100,
        });
      if (saleError) throw saleError;

      // Update item status to flipped
      const { error: itemError } = await supabase
        .from('items')
        .update({ status: 'flipped', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (itemError) throw itemError;

      fireConfetti();
      toast.success('Sale recorded! Nice flip!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-lg text-slate-900">Record Sale</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
          <span className="font-medium text-slate-700">{itemName}</span>
          {purchasePrice > 0 && <span className="ml-2">· Cost: ${purchasePrice.toFixed(2)}</span>}
        </div>

        <div className="space-y-3">
          {/* Platform */}
          <div>
            <Label className="text-sm">Platform Sold On *</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue placeholder="Select platform..." />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Sale Price */}
          <div>
            <Label className="text-sm">Sale Price *</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                placeholder="0.00"
                className="h-11 pl-7"
                autoFocus
              />
            </div>
          </div>

          {/* Cost breakdown row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Shipping</Label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={shippingCost}
                  onChange={e => setShippingCost(e.target.value)}
                  className="h-10 text-sm pl-6"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Platform Fees</Label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={platformFees}
                  onChange={e => setPlatformFees(e.target.value)}
                  className="h-10 text-sm pl-6"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Other Costs</Label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={otherCosts}
                  onChange={e => setOtherCosts(e.target.value)}
                  className="h-10 text-sm pl-6"
                />
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <Label className="text-sm">Internal Notes</Label>
            <Textarea
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              placeholder="Buyer info, shipping details..."
              className="mt-1 min-h-16 text-sm"
            />
          </div>
        </div>

        {/* Profit preview */}
        {salePriceNum > 0 && (
          <div className={`rounded-xl p-3 text-sm font-medium text-center ${netProfit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <DollarSign className="w-4 h-4 inline mr-1" />
            Net Profit: {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
            <span className="text-xs opacity-70 ml-2">
              (sale - cost - shipping - fees - other)
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-12" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit} disabled={saving}>
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Complete Sale'
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
