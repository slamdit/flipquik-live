import React, { useState, useEffect } from 'react';
import { Link2, CheckCircle, XCircle, Zap, Hand, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const ALL_PLATFORMS = [
  { key: 'ebay', name: 'eBay', mode: 'direct', description: 'Direct publish, update, and delist', url: 'https://www.ebay.com' },
  { key: 'etsy', name: 'Etsy', mode: 'direct', description: 'Direct listing (coming soon)', url: 'https://www.etsy.com' },
  { key: 'poshmark', name: 'Poshmark', mode: 'assisted', description: 'FlipQuik prepares your draft — you post it', url: 'https://poshmark.com' },
  { key: 'mercari', name: 'Mercari', mode: 'assisted', description: 'FlipQuik prepares your draft — you post it', url: 'https://www.mercari.com' },
  { key: 'depop', name: 'Depop', mode: 'assisted', description: 'FlipQuik prepares your draft — you post it', url: 'https://www.depop.com' },
  { key: 'grailed', name: 'Grailed', mode: 'assisted', description: 'FlipQuik prepares your draft — you post it', url: 'https://www.grailed.com' },
  { key: 'facebook_marketplace', name: 'Facebook Marketplace', mode: 'assisted', description: 'FlipQuik prepares your draft — you post it', url: 'https://www.facebook.com/marketplace' },
  { key: 'whatnot', name: 'Whatnot', mode: 'assisted', description: 'FlipQuik prepares your draft — you post it', url: 'https://www.whatnot.com' },
];

const MODE_BADGE = {
  direct: { label: 'Direct', color: 'bg-emerald-100 text-emerald-700', icon: Zap },
  assisted: { label: 'Assisted', color: 'bg-blue-100 text-blue-700', icon: Hand },
};

function PlatformConnectionCard({ platform, account, onToggle, onDisconnect }) {
  const modeCfg = MODE_BADGE[platform.mode];
  const ModeIcon = modeCfg.icon;
  const isEnabled = account?.enabled_for_distribution !== false;
  const isConnected = account?.is_connected && platform.mode === 'direct';

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{platform.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${modeCfg.color}`}>
              <ModeIcon className="w-3 h-3" />{modeCfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{platform.description}</p>

          {platform.mode === 'direct' && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {isConnected ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">Connected</span>
                  {account?.account_name && <span className="text-xs text-slate-400">· {account.account_name}</span>}
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-xs text-slate-400">Not connected</span>
                </>
              )}
            </div>
          )}

          {platform.mode === 'assisted' && (
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={isEnabled}
                onCheckedChange={(val) => onToggle(platform.key, val)}
              />
              <span className="text-xs text-slate-600">{isEnabled ? 'Enabled for distribution' : 'Disabled'}</span>
            </div>
          )}
        </div>

        {platform.mode === 'direct' && (
          <div className="shrink-0">
            {isConnected ? (
              <Button size="sm" variant="outline" onClick={() => onDisconnect(platform.key)} className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50">
                Disconnect
              </Button>
            ) : platform.key === 'ebay' ? (
              <a href="/Settings">
                <Button size="sm" className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white">
                  Connect
                </Button>
              </a>
            ) : (
              <Button size="sm" variant="outline" disabled className="h-8 text-xs opacity-50">
                Coming Soon
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplaceConnections() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    const accs = await base44.entities.MarketplaceAccount.filter({ user_id: user.id });
    setAccounts(accs);
    setLoading(false);
  };

  const getAccountFor = (platform) => accounts.find(a => a.platform === platform);

  const handleToggle = async (platform, enabled) => {
    const user = await base44.auth.me();
    const existing = getAccountFor(platform);
    if (existing) {
      await base44.entities.MarketplaceAccount.update(existing.id, { enabled_for_distribution: enabled });
    } else {
      await base44.entities.MarketplaceAccount.create({
        user_id: user.id,
        platform,
        enabled_for_distribution: enabled,
        is_connected: false,
        oauth_status: 'not_connected',
      });
    }
    toast.success(`${platform} ${enabled ? 'enabled' : 'disabled'} for distribution`);
    await loadAccounts();
  };

  const handleDisconnect = async (platform) => {
    const existing = getAccountFor(platform);
    if (!existing) return;
    await base44.entities.MarketplaceAccount.update(existing.id, { is_connected: false, oauth_status: 'not_connected', access_token_encrypted: '', refresh_token_encrypted: '' });
    toast.success(`Disconnected from ${platform}`);
    await loadAccounts();
  };

  const directPlatforms = ALL_PLATFORMS.filter(p => p.mode === 'direct');
  const assistedPlatforms = ALL_PLATFORMS.filter(p => p.mode === 'assisted');

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Link2 className="w-7 h-7 text-blue-400" />
          <h1 className="text-2xl font-bold">Marketplace Connections</h1>
        </div>
        <p className="text-slate-400 text-sm">Manage your selling platforms</p>
      </div>

      <div className="p-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 space-y-1">
              <p><span className="font-semibold">Direct</span> — FlipQuik publishes, updates, and delists automatically.</p>
              <p><span className="font-semibold">Assisted</span> — FlipQuik prepares everything; you finish posting on the platform.</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Direct Integration</p>
              <div className="space-y-2">
                {directPlatforms.map(p => (
                  <PlatformConnectionCard key={p.key} platform={p} account={getAccountFor(p.key)} onToggle={handleToggle} onDisconnect={handleDisconnect} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Assisted Posting</p>
              <div className="space-y-2">
                {assistedPlatforms.map(p => (
                  <PlatformConnectionCard key={p.key} platform={p} account={getAccountFor(p.key)} onToggle={handleToggle} onDisconnect={handleDisconnect} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}