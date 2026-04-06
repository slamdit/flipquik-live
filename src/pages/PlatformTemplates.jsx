import React, { useState, useEffect } from 'react';
import { Settings, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const PLATFORMS = [
  { key: 'poshmark', name: 'Poshmark', hint: 'Social, casual tone. Use emojis. Max 80 char title.' },
  { key: 'mercari', name: 'Mercari', hint: 'Clear and concise. Keep titles under 40 chars.' },
  { key: 'depop', name: 'Depop', hint: 'Trendy, Gen-Z tone. Use hashtags and emojis.' },
  { key: 'grailed', name: 'Grailed', hint: 'Designer-focused. Emphasize authenticity & brand.' },
  { key: 'facebook_marketplace', name: 'Facebook Marketplace', hint: 'Local, casual tone. Mention pickup/shipping.' },
  { key: 'whatnot', name: 'Whatnot', hint: 'Auction-style language. Emphasize rarity/collectibility.' },
  { key: 'etsy', name: 'Etsy', hint: 'SEO-optimized. Use descriptive keywords for vintage/handmade.' },
  { key: 'ebay', name: 'eBay', hint: 'Search-optimized title. Condition & details matter.' },
];

const PRICING_STRATEGIES = [
  { value: 'use_master_price', label: 'Use master price as-is' },
  { value: 'round_up', label: 'Round up to nearest dollar' },
  { value: 'round_down', label: 'Round down to nearest dollar' },
  { value: 'percentage_adjustment', label: 'Adjust by percentage' },
];

function PlatformTemplateCard({ platform, template, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    title_template: template?.title_template || '',
    description_template: template?.description_template || '',
    pricing_strategy: template?.pricing_strategy || 'use_master_price',
    price_adjustment_percent: template?.price_adjustment_percent || 0,
    notes: template?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(platform.key, form);
    setSaving(false);
    setExpanded(false);
  };

  const hasTemplate = !!(template?.title_template || template?.description_template);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-900">{platform.name}</span>
            {hasTemplate && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Configured</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{platform.hint}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 pt-3">
            Use <code className="bg-slate-100 px-1 rounded">{'{brand}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{item_name}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{condition}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{size}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{color}'}</code> as placeholders.
          </p>

          <div>
            <Label className="text-xs font-medium text-slate-600">Title Template</Label>
            <Input value={form.title_template} onChange={set('title_template')} className="mt-1 h-9 text-sm" placeholder={`e.g. {brand} {item_name} - {condition}`} />
          </div>

          <div>
            <Label className="text-xs font-medium text-slate-600">Description Template</Label>
            <Textarea value={form.description_template} onChange={set('description_template')} className="mt-1 min-h-20 text-sm" placeholder={`e.g. ✨ {item_name} by {brand}\n\nCondition: {condition}\nSize: {size}`} />
          </div>

          <div>
            <Label className="text-xs font-medium text-slate-600">Pricing Strategy</Label>
            <Select value={form.pricing_strategy} onValueChange={val => setForm(f => ({ ...f, pricing_strategy: val }))}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_STRATEGIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.pricing_strategy === 'percentage_adjustment' && (
            <div>
              <Label className="text-xs font-medium text-slate-600">Price Adjustment (%)</Label>
              <Input
                type="number"
                step="1"
                value={form.price_adjustment_percent}
                onChange={set('price_adjustment_percent')}
                className="mt-1 h-9 text-sm w-32"
                placeholder="e.g. 10 for +10%"
              />
              <p className="text-xs text-slate-400 mt-1">Positive = mark up, negative = mark down</p>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium text-slate-600">Notes (internal)</Label>
            <Input value={form.notes} onChange={set('notes')} className="mt-1 h-9 text-sm" placeholder="Any reminders for this platform..." />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-sm">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save Template</>}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PlatformTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    const data = await base44.entities.PlatformTemplate.filter({ user_id: user.id });
    setTemplates(data);
    setLoading(false);
  };

  const getTemplate = (platform) => templates.find(t => t.platform === platform);

  const handleSave = async (platform, form) => {
    const user = await base44.auth.me();
    const existing = getTemplate(platform);
    if (existing) {
      await base44.entities.PlatformTemplate.update(existing.id, form);
    } else {
      await base44.entities.PlatformTemplate.create({ user_id: user.id, platform, ...form });
    }
    toast.success('Template saved!');
    await loadTemplates();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-7 h-7 text-blue-400" />
          <h1 className="text-2xl font-bold">Platform Templates</h1>
        </div>
        <p className="text-slate-400 text-sm">Customize title, description, and pricing per platform</p>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 mb-3">
              Templates are applied when building drafts. If no template is set, FlipQuik uses smart defaults with AI generation.
            </div>
            {PLATFORMS.map(p => (
              <PlatformTemplateCard
                key={p.key}
                platform={p}
                template={getTemplate(p.key)}
                onSave={handleSave}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}