import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Check, Zap, Crown, Loader2, ExternalLink, Rocket } from 'lucide-react';
import supabase from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const FREE_FEATURES = [
  '3 QuikEvals per day',
  'Up to 25 inventory items',
  '3 listing generations per day',
  'Basic sales tracking',
  'Send listing via email/text',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited QuikEvals & MultiEvals',
  'Unlimited inventory',
  'Real eBay sold comps',
  'Performance dashboard & analytics',
  'CSV/PDF export',
  'Priority AI processing',
];

const MAX_FEATURES = [
  { text: 'Everything in Pro', comingSoon: false },
  { text: 'Auto-post to eBay', comingSoon: true },
  { text: 'Auto-delist across platforms', comingSoon: true },
  { text: 'Import existing marketplace inventory', comingSoon: true },
  { text: 'Multi-platform sync', comingSoon: true },
  { text: 'Advanced analytics', comingSoon: false },
];

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // 'pro' | 'max' | null
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast.success('Subscription activated! Welcome aboard.');
      setSearchParams({}, { replace: true });
      loadProfile();
    } else if (status === 'cancel') {
      toast.info('Checkout canceled. No charges were made.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('is_pro, subscription_status, current_period_end, stripe_customer_id, plan_tier')
      .eq('id', user.id)
      .single();

    setProfile(data);
    setLoading(false);
  }

  async function handleUpgrade(plan) {
    setCheckoutLoading(plan);
    try {
      const res = await supabase.functions.invoke('create-checkout-session', {
        body: { origin: window.location.origin, plan },
      });

      if (res.error) throw new Error(res.error.message || JSON.stringify(res.error));
      const errorMsg = res.data?.error;
      if (errorMsg) throw new Error(errorMsg);
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const res = await supabase.functions.invoke('create-portal-session', {
        body: { origin: window.location.origin },
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

  const planTier = profile?.plan_tier || 'free';
  const isPaid = profile?.is_pro;
  const status = profile?.subscription_status || 'free';
  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString()
    : null;

  const planLabel = planTier === 'max' ? 'FlipQuik Max' : planTier === 'pro' ? 'FlipQuik Pro' : 'Free';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <CreditCard className="w-7 h-7 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
      </div>

      {/* Current plan status */}
      {isPaid && (
        <div className="mb-8 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {planTier === 'max' ? <Rocket className="w-5 h-5 text-violet-600" /> : <Crown className="w-5 h-5 text-amber-600" />}
              <span className="font-semibold text-amber-800">{planLabel}</span>
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
            Your payment failed. Please update your payment method to keep your subscription.
          </p>
        </div>
      )}

      {/* Pricing cards — 3 columns */}
      <div className="grid md:grid-cols-3 gap-5">
        {/* ── Free ── */}
        <div className={`rounded-xl border-2 p-6 flex flex-col ${planTier === 'free' && !isPaid ? 'border-slate-800 bg-slate-50' : 'border-slate-200'}`}>
          <h2 className="text-lg font-bold text-slate-900">Free</h2>
          <div className="mt-2 mb-6">
            <span className="text-3xl font-bold text-slate-900">$0</span>
            <span className="text-slate-500">/month</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {planTier === 'free' && !isPaid && (
            <div className="text-center text-sm text-slate-500 font-medium py-2">
              Current plan
            </div>
          )}
        </div>

        {/* ── Pro ── */}
        <div className={`rounded-xl border-2 p-6 flex flex-col relative ${planTier === 'pro' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              Most Popular
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Pro</h2>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 mb-6">
            <span className="text-3xl font-bold text-slate-900">$19</span>
            <span className="text-slate-500">/month</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {planTier === 'pro' ? (
            <Button
              onClick={handleManage}
              disabled={portalLoading}
              variant="outline"
              className="w-full"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Manage Subscription
            </Button>
          ) : planTier === 'max' ? (
            <div className="text-center text-sm text-slate-400 font-medium py-2">
              Included in Max
            </div>
          ) : (
            <Button
              onClick={() => handleUpgrade('pro')}
              disabled={checkoutLoading !== null}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
            >
              {checkoutLoading === 'pro' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Upgrade to Pro
            </Button>
          )}
        </div>

        {/* ── Max ── */}
        <div className={`rounded-xl border-2 p-6 flex flex-col relative ${planTier === 'max' ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              Power Seller
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Max</h2>
            <Rocket className="w-4 h-4 text-violet-600" />
          </div>
          <div className="mt-2 mb-6">
            <span className="text-3xl font-bold text-slate-900">$39</span>
            <span className="text-slate-500">/month</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {MAX_FEATURES.map(({ text, comingSoon }) => (
              <li key={text} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className={`w-4 h-4 mt-0.5 shrink-0 ${comingSoon ? 'text-slate-300' : 'text-violet-500'}`} />
                <span className={comingSoon ? 'text-slate-400' : ''}>
                  {text}
                  {comingSoon && (
                    <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                      Coming Soon
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-400 mb-3 text-center">
            Subscribe now — get all Pro features immediately. Max features roll out over time.
          </p>

          {planTier === 'max' ? (
            <Button
              onClick={handleManage}
              disabled={portalLoading}
              variant="outline"
              className="w-full"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Manage Subscription
            </Button>
          ) : (
            <Button
              onClick={() => handleUpgrade('max')}
              disabled={checkoutLoading !== null}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {checkoutLoading === 'max' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
              {planTier === 'pro' ? 'Upgrade to Max' : 'Go Max'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
