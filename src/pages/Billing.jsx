import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Check, Zap, Crown, Loader2, ExternalLink } from 'lucide-react';
import supabase from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const FREE_FEATURES = [
  'QuikEval — AI item evaluation',
  'Up to 25 inventory items',
  'Basic sales tracking',
  'Manual listing workflow',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited inventory items',
  'eBay integration & auto-sync',
  'MultiEval — batch evaluations',
  'Platform templates',
  'eBay sold comps',
  'Priority support',
];

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Handle success/cancel URL params
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast.success('Welcome to FlipQuik Pro! Your subscription is active.');
      setSearchParams({}, { replace: true });
      loadProfile();
    } else if (status === 'cancel') {
      toast.info('Checkout canceled. No charges were made.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('is_pro, subscription_status, current_period_end, stripe_customer_id')
      .eq('id', user.id)
      .single();

    setProfile(data);
    setLoading(false);
  }

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-checkout-session', {
        body: { origin: window.location.origin },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-portal-session', {
        body: { origin: window.location.origin },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const isPro = profile?.is_pro;
  const status = profile?.subscription_status || 'free';
  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString()
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <CreditCard className="w-7 h-7 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
      </div>

      {/* Current plan status */}
      {isPro && (
        <div className="mb-8 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-800">FlipQuik Pro</span>
              <span className="text-sm text-amber-600 capitalize">({status})</span>
            </div>
            {periodEnd && (
              <span className="text-sm text-amber-600">
                {status === 'canceled' ? 'Access until' : 'Renews'} {periodEnd}
              </span>
            )}
          </div>
        </div>
      )}

      {status === 'past_due' && (
        <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-red-800 font-medium">
            Your payment failed. Please update your payment method to keep Pro access.
          </p>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free tier */}
        <div className={`rounded-xl border-2 p-6 ${!isPro ? 'border-slate-800 bg-slate-50' : 'border-slate-200'}`}>
          <h2 className="text-lg font-bold text-slate-900">Free</h2>
          <div className="mt-2 mb-6">
            <span className="text-3xl font-bold text-slate-900">$0</span>
            <span className="text-slate-500">/month</span>
          </div>
          <ul className="space-y-3 mb-8">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="text-center text-sm text-slate-500 font-medium py-2">
              Current plan
            </div>
          )}
        </div>

        {/* Pro tier */}
        <div className={`rounded-xl border-2 p-6 ${isPro ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Pro</h2>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 mb-6">
            <span className="text-3xl font-bold text-slate-900">$19</span>
            <span className="text-slate-500">/month</span>
          </div>
          <ul className="space-y-3 mb-8">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {isPro ? (
            <Button
              onClick={handleManage}
              disabled={portalLoading}
              variant="outline"
              className="w-full"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          ) : (
            <Button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
            >
              {checkoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
