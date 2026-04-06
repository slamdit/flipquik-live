import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Link as LinkIcon, CheckCircle, AlertCircle, Loader2, User, Lock, Eye, EyeOff, Layers } from 'lucide-react';
import supabase from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        setFullName(user.user_metadata?.full_name || '');
      }
    });
  }, []);

  const isConnected = !!(user?.user_metadata?.ebay_access_token);
  const tokenExpiry = user?.user_metadata?.ebay_token_expiry ? new Date(user.user_metadata.ebay_token_expiry) : null;
  const isExpired = tokenExpiry && tokenExpiry < new Date();

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (error) throw error;
      setUser(prev => ({ ...prev, user_metadata: { ...prev?.user_metadata, full_name: fullName } }));
      toast.success('Profile updated.');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated.');
    } catch {
      toast.error('Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('generateEbayAuthUrl', { body: {} });
      if (error) throw error;
      window.open(data.authUrl, '_blank');
    } catch {
      toast.error('Failed to generate eBay auth URL.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const { error } = await supabase.auth.updateUser({
      data: { ebay_access_token: null, ebay_refresh_token: null, ebay_token_expiry: null }
    });
    if (!error) {
      setUser(prev => ({
        ...prev,
        user_metadata: { ...prev?.user_metadata, ebay_access_token: null, ebay_refresh_token: null, ebay_token_expiry: null }
      }));
      toast.success('eBay account disconnected.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-slate-500" />
            <p className="font-semibold text-slate-900 text-sm">Profile</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Email</Label>
              <Input value={user?.email || ''} disabled className="bg-slate-50 text-slate-400 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" className="text-sm" />
            </div>
            <Button size="sm" className="w-full bg-slate-900 hover:bg-slate-800 text-white" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Profile
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-slate-500" />
            <p className="font-semibold text-slate-900 text-sm">Security</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">New Password</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="pr-10 text-sm" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Confirm Password</Label>
              <Input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="text-sm" />
            </div>
            <Button size="sm" className="w-full bg-slate-900 hover:bg-slate-800 text-white" onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Password
            </Button>
          </div>
        </div>

        <Link to="/PlatformTemplates">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">Platform Templates</p>
              <p className="text-xs text-slate-500">Customize titles, descriptions & pricing per platform</p>
            </div>
            <LinkIcon className="w-4 h-4 text-slate-400" />
          </div>
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
              <span className="text-xl">🛒</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900">eBay</p>
              <p className="text-xs text-slate-500">Connect your eBay account to sync listings</p>
            </div>
            {isConnected && !isExpired ? (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            ) : isConnected && isExpired ? (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            ) : null}
          </div>

          {isConnected && !isExpired && (
            <div className="bg-green-50 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-green-700 font-medium">Connected</p>
              {tokenExpiry && <p className="text-xs text-green-600 mt-0.5">Token expires {tokenExpiry.toLocaleDateString()}</p>}
            </div>
          )}
          {isConnected && isExpired && (
            <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-amber-700 font-medium">Token expired — reconnect to refresh</p>
            </div>
          )}

          {isConnected && !isExpired ? (
            <Button variant="outline" size="sm" className="w-full border-red-200 text-red-600 hover:bg-red-50" onClick={handleDisconnect}>
              Disconnect eBay
            </Button>
          ) : (
            <Button size="sm" className="w-full bg-slate-900 hover:bg-slate-800 text-white" onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting...</>
              ) : (
                <><LinkIcon className="w-4 h-4 mr-2" />{isExpired ? 'Reconnect eBay' : 'Connect eBay'}</>
              )}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
