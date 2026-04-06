import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, CheckCircle, AlertCircle, Clock, ExternalLink, Copy, ChevronDown, ChevronUp, Zap, Hand } from 'lucide-react';
import ImageUploadZone from '@/components/common/ImageUploadZone';
import { Button } from '@/components/ui/button';
import { items, marketplaceListings, marketplaceActions } from '@/lib/supabase';
import supabase from '@/lib/supabase';
import { toast } from 'sonner';

const PLATFORMS = [
  { key: 'poshmark', name: 'Poshmark', mode: 'assisted', url: 'https://poshmark.com' },
  { key: 'mercari', name: 'Mercari', mode: 'assisted', url: 'https://www.mercari.com' },
  { key: 'depop', name: 'Depop', mode: 'assisted', url: 'https://www.depop.com' },
  { key: 'grailed', name: 'Grailed', mode: 'assisted', url: 'https://www.grailed.com' },
  { key: 'facebook_marketplace', name: 'Facebook Marketplace', mode: 'assisted', url: 'https://www.facebook.com/marketplace' },
  { key: 'whatnot', name: 'Whatnot', mode: 'assisted', url: 'https://www.whatnot.com' },
  { key: 'etsy', name: 'Etsy', mode: 'direct_placeholder', url: 'https://www.etsy.com' },
];

const MODE_BADGE = {
  direct: { label: 'Direct', color: 'bg-emerald-100 text-emerald-700' },
  assisted: { label: 'Assisted', color: 'bg-blue-100 text-blue-700' },
  direct_placeholder: { label: 'Coming Soon', color: 'bg-slate-100 text-slate-400' },
};

const STATUS_CONFIG = {
  not_listed:      { label: 'Not Listed',    color: 'text-slate-400', icon: null },
  draft_prepared:  { label: 'Draft Ready',   color: 'text-blue-600',  icon: CheckCircle },
  listed:          { label: 'Listed',        color: 'text-emerald-600', icon: CheckCircle },
  sold:            { label: 'Sold',          color: 'text-purple-600', icon: CheckCircle },
  pending_delist:  { label: 'Delist Needed', color: 'text-red-600',   icon: AlertCircle },
  delisted:        { label: 'Delisted',      color: 'text-slate-400', icon: null },
  sync_error:      { label: 'Error',         color: 'text-red-600',   icon: AlertCircle },
  manual_action_required: { label: 'Needs Action', color: 'text-amber-600', icon: Clock },
};

function PlatformCard({ platform, listing, onPrepareDraft, onMarkPosted, preparing }) {
  const [expanded, setExpanded] = useState(false);
  const status = listing?.listing_status || 'not_listed';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_listed;
  const modeCfg = MODE_BADGE[platform.mode] || MODE_BADGE.assisted;
  const StatusIcon = cfg.icon;

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900">{platform.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${modeCfg.color}`}>{modeCfg.label}</span>
          </div>
          <div className={`flex items-center gap-1 mt-0.5 text-xs ${cfg.color}`}>
            {StatusIcon && <StatusIcon className="w-3 h-3" />}
            <span>{cfg.label}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {platform.mode === 'direct_placeholder' ? (
            <Button size="sm" variant="outline" disabled className="h-8 text-xs opacity-50">Soon</Button>
          ) : status === 'not_listed' ? (
            <Button size="sm" onClick={() => onPrepareDraft(platform.key)} disabled={preparing === platform.key} className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white">
              {preparing === platform.key ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Hand className="w-3 h-3 mr-1" />Prepare</>}
            </Button>
          ) : status === 'draft_prepared' ? (
            <Button size="sm" onClick={() => setExpanded(!expanded)} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">Open Draft</Button>
          ) : status === 'listed' ? (
            <a href={listing?.external_listing_url || platform.url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-8 text-xs"><ExternalLink className="w-3 h-3 mr-1" />View</Button>
            </a>
          ) : null}
        </div>
      </div>

      {expanded && listing && (
        <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase">Title</span>
              <button onClick={() => copy(listing.platform_title)} className="text-xs text-blue-600 flex items-center gap-1"><Copy className="w-3 h-3" />Copy</button>
            </div>
            <p className="text-sm text-slate-800 bg-white rounded-lg p-2 border border-slate-200">{listing.platform_title}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase">Description</span>
              <button onClick={() => copy(listing.platform_description)} className="text-xs text-blue-600 flex items-center gap-1"><Copy className="w-3 h-3" />Copy</button>
            </div>
            <p className="text-sm text-slate-800 bg-white rounded-lg p-2 border border-slate-200 whitespace-pre-line max-h-40 overflow-y-auto">{listing.platform_description}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500">Price</span>
              <p className="text-lg font-bold text-slate-900">${listing.platform_price?.toFixed(2)}</p>
            </div>
            <a href={platform.url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-9 text-xs"><ExternalLink className="w-3 h-3 mr-1" />Open {platform.name}</Button>
            </a>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Item Photos</p>
            <ImageUploadZone item_id={listing.item_id} />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
            <p className="font-semibold mb-1">Steps to post:</p>
            <ol className="space-y-0.5 list-decimal list-inside">
              <li>Copy the title above</li>
              <li>Copy the description above</li>
              <li>Upload your item photos</li>
              <li>Set price to ${listing.platform_price?.toFixed(2)}</li>
              <li>Submit the listing</li>
            </ol>
          </div>
          <Button onClick={() => onMarkPosted(platform.key, listing.id)} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
            <CheckCircle className="w-4 h-4 mr-2" />Mark as Posted
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DistributeListing() {
  const urlParams = new URLSearchParams(window.location.search);
  const item_id = urlParams.get('item_id');
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [listings, setListings] = useState([]);
  const [preparing, setPreparing] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item_id) { setLoading(false); return; }
    loadData();
  }, [item_id]);

  const loadData = async () => {
    setLoading(true);
    const [itemRes, listingsRes] = await Promise.all([
      items.getAll({ filters: { id: item_id } }),
      marketplaceListings.getAll({ filters: { item_id } }),
    ]);
    setItem(itemRes[0] || null);
    setListings(listingsRes);
    setLoading(false);
  };

  const getListingFor = (platform) => listings.find(l => l.platform === platform);

  const handlePrepareDraft = async (platform) => {
    setPreparing(platform);
    try {
      const { error } = await supabase.functions.invoke('buildPlatformDrafts', { body: { item_id, platforms: [platform] } });
      if (error) throw error;
      toast.success(`Draft prepared for ${platform}!`);
      await loadData();
    } catch {
      toast.error('Failed to prepare draft');
    } finally {
      setPreparing(null);
    }
  };

  const handleSendAll = async () => {
    setSendingAll(true);
    const assistedPlatforms = PLATFORMS.filter(p => p.mode === 'assisted').map(p => p.key);
    try {
      const { error } = await supabase.functions.invoke('buildPlatformDrafts', { body: { item_id, platforms: assistedPlatforms } });
      if (error) throw error;
      toast.success('Drafts prepared for all platforms!');
      await loadData();
    } catch {
      toast.error('Failed to prepare all drafts');
    } finally {
      setSendingAll(false);
    }
  };

  const handleMarkPosted = async (platform, listingId) => {
    await marketplaceListings.update(listingId, { listing_status: 'listed' });
    const pendingActions = await marketplaceActions.getAll({ filters: { marketplace_listing_id: listingId, action_type: 'publish', action_status: 'pending' } });
    for (const a of pendingActions) {
      await marketplaceActions.update(a.id, { action_status: 'completed', completed_at: new Date().toISOString() });
    }
    toast.success(`Marked as listed on ${platform}!`);
    await loadData();
  };

  if (!item_id) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">No item selected. Go to Inventory and open an item.</p>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );

  const listedCount = listings.filter(l => l.listing_status === 'listed').length;
  const draftCount = listings.filter(l => l.listing_status === 'draft_prepared').length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Share2 className="w-7 h-7 text-blue-400" />
          <h1 className="text-2xl font-bold">Distribute Listing</h1>
        </div>
        {item && (
          <div className="mt-2">
            <p className="font-semibold text-white truncate">{item.master_title || item.item_name}</p>
            <p className="text-slate-400 text-sm">${item.suggested_price || item.purchase_price || '—'}</p>
          </div>
        )}
        {(listedCount > 0 || draftCount > 0) && (
          <div className="flex gap-3 mt-2 text-xs text-slate-300">
            {listedCount > 0 && <span className="text-emerald-400">{listedCount} listed</span>}
            {draftCount > 0 && <span className="text-blue-400">{draftCount} drafts ready</span>}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <Button onClick={handleSendAll} disabled={sendingAll} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
          {sendingAll ? (
            <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Preparing all drafts...</div>
          ) : (
            <><Zap className="w-4 h-4 mr-2" />Send to All Platforms</>
          )}
        </Button>
        <div className="text-xs text-slate-400 text-center px-4">
          <span className="font-medium text-emerald-600">Direct</span> = auto-posted · <span className="font-medium text-blue-600">Assisted</span> = FlipQuik prepares, you finish posting
        </div>
        <div className="space-y-2">
          {PLATFORMS.map(platform => (
            <PlatformCard key={platform.key} platform={platform} listing={getListingFor(platform.key)} onPrepareDraft={handlePrepareDraft} onMarkPosted={handleMarkPosted} preparing={preparing} />
          ))}
        </div>
      </div>
    </div>
  );
}
