import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Check,
  ArrowRight,
  Camera,
  TrendingUp,
  BarChart3,
  Package,
  FileText,
  Zap,
  Mail,
  Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import supabase from '@/lib/supabase';

/**
 * FlipQuik public landing page.
 *
 * Routed at "/" for logged-out visitors via App.jsx.
 * Logged-in visitors are redirected to /Dashboard before they ever see this.
 *
 * Brief: /TikTok Assets/Landing Page Copy - flipquik.com.md
 * Build decisions (2026-05-11):
 *   - Founder story Version B (fuller, conversion-driver version)
 *   - Pricing card shows Pro only; Max is hidden until auto-post ships
 *   - Trust/social-proof section is rendered as a hidden div, ready to switch on
 *   - Email capture writes to the public.leads table (RLS allows anon inserts).
 *     Welcome-sequence delivery is a separate ESP step — wire Klaviyo /
 *     Mailchimp / ConvertKit to poll or webhook against `leads` when ready.
 */

// One-line brand-color knob. Swap "emerald" for your exact Tailwind brand palette
// if/when you wire one up; e.g. "brand" with a tailwind.config extension.
const BRAND = {
  bg: 'bg-emerald-600',
  bgHover: 'hover:bg-emerald-700',
  bgGradient: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
  bgSoft: 'bg-emerald-50',
  text: 'text-emerald-600',
  textOnDark: 'text-emerald-50',
  border: 'border-emerald-600',
  ring: 'focus:ring-emerald-500',
};

export default function Landing() {
  const navigate = useNavigate();

  // SEO: title + description + OG/Twitter cards in the absence of react-helmet-async.
  // If/when helmet is added, lift these into a <Helmet> block.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'FlipQuik — The reseller profit app for busy people';

    const META_DESCRIPTION =
      "Track every flip. Know your real profit. FlipQuik is the reseller app built for people with day jobs and dinner to make. Free trial. Free Playbook.";

    // attrKey is "name" for standard meta, "property" for Open Graph
    const ensureMeta = (attrKey, attrValue, content) => {
      let tag = document.querySelector(`meta[${attrKey}="${attrValue}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attrKey, attrValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
      return tag;
    };

    ensureMeta('name', 'description', META_DESCRIPTION);

    // Open Graph (used by Facebook, LinkedIn, iMessage previews, etc.)
    ensureMeta('property', 'og:title', 'FlipQuik — Track Every Flip. Know Your Real Profit.');
    ensureMeta(
      'property',
      'og:description',
      "Reseller profit app for working parents. Source on lunch breaks. List at night. Finally know what you're earning."
    );
    ensureMeta('property', 'og:type', 'website');
    ensureMeta('property', 'og:url', 'https://flipquik.com/');
    // TODO: replace with hosted hero image (1200x630 recommended for OG)
    ensureMeta('property', 'og:image', 'https://flipquik.com/og-image.png');

    // Twitter card
    ensureMeta('name', 'twitter:card', 'summary_large_image');
    ensureMeta('name', 'twitter:title', 'FlipQuik — Track Every Flip. Know Your Real Profit.');
    ensureMeta(
      'name',
      'twitter:description',
      "Reseller profit app for working parents. Source on lunch breaks. List at night. Finally know what you're earning."
    );
    // TODO: replace with hosted hero image (same one as og:image is fine)
    ensureMeta('name', 'twitter:image', 'https://flipquik.com/og-image.png');

    return () => {
      // Restore title when the user navigates away (e.g. to /login).
      // Leave meta tags in place — they're harmless if they linger.
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <PublicNav />
      <Hero onCtaClick={() => navigate('/login')} />
      <ThreeDoors onTrialClick={() => navigate('/login')} />
      <PainPoints />
      <WhatItDoes />
      <FreeResources />
      <Pricing onCtaClick={() => navigate('/login')} />
      <FounderStory />
      <TrustSocialProof />
      <FinalCta onCtaClick={() => navigate('/login')} />
      <Footer />
    </main>
  );
}

/* ───────────────────────────── Public top nav ───────────────────────────── */

function PublicNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl tracking-tight">
          <span className={BRAND.text}>Flip</span>
          <span>Quik</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-700">
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          <Link to="/comeback" className="hover:text-slate-900">The Comeback Plan</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-slate-700 hover:text-slate-900"
          >
            Sign in
          </Link>
          <Button
            onClick={() => (window.location.href = '/login')}
            className={`${BRAND.bg} ${BRAND.bgHover} text-white`}
          >
            Try free
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────────── Section 1: Hero ───────────────────────────── */

function Hero({ onCtaClick }) {
  return (
    <section className={`${BRAND.bgGradient} text-white pt-32 pb-24`}>
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Track every flip.<br />Know your real profit.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-emerald-50/90 max-w-xl">
            FlipQuik is a reseller profit app built for people with day jobs
            and dinner to make. Source on lunch breaks. List after the kids
            are asleep. Finally know what you're actually earning.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <Button
              size="lg"
              onClick={onCtaClick}
              className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold px-6"
            >
              Try FlipQuik free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a
              href="#free-resources"
              className="text-emerald-50 underline underline-offset-4 hover:text-white text-sm"
            >
              Get the free Reseller Profit Playbook →
            </a>
          </div>
        </div>

        {/* Placeholder for hero visual — swap for dashboard screenshot or founder photo */}
        <div className="hidden md:block">
          <div className="aspect-[4/3] rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center text-emerald-50/70">
            <div className="text-center px-6">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-80" />
              <p className="text-sm">
                Hero image goes here.<br />
                Suggest: annotated dashboard screenshot.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 2: Three Doors ─────────────────────── */

function ThreeDoors({ onTrialClick }) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
        {/* Door 1 */}
        <DoorCard
          title="Try FlipQuik free"
          body="Two-week trial. Pro access, no card required."
          ctaLabel="Start free trial"
          onClick={onTrialClick}
          primary
        />
        {/* Door 2 */}
        <DoorCard
          title="Not ready to sign up?"
          body="Get the free Reseller Profit Playbook + Profit Tracker spreadsheet."
          ctaLabel="Send me the free guide"
          onClick={() => {
            // Scroll smoothly to the email capture block
            document
              .getElementById('free-resources')
              ?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        {/* Door 3 */}
        <DoorCard
          title="Recently laid off?"
          body="The Comeback Plan: 90 days of FlipQuik Pro, free. Built by a founder who's been there."
          ctaLabel="Learn about the Comeback Plan"
          onClick={() => (window.location.href = '/comeback')}
          accent
        />
      </div>
    </section>
  );
}

function DoorCard({ title, body, ctaLabel, onClick, primary, accent }) {
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col h-full transition-shadow hover:shadow-lg ${
        primary
          ? 'border-emerald-200 bg-emerald-50/50'
          : accent
          ? 'border-amber-200 bg-amber-50/50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-slate-600 flex-1">{body}</p>
      <button
        onClick={onClick}
        className={`mt-6 inline-flex items-center text-sm font-semibold ${
          accent ? 'text-amber-700 hover:text-amber-800' : `${BRAND.text} hover:text-emerald-700`
        }`}
      >
        {ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
      </button>
    </div>
  );
}

/* ─────────────────────── Section 3: Pain You Solve ──────────────────────── */

function PainPoints() {
  const lines = [
    "I don't have time to do the math after every sale.",
    "I'm not sure which platform is actually paying me.",
    "I think I'm working for $4 an hour. I don't want to find out for sure.",
  ];
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className={`text-xs tracking-widest uppercase font-semibold ${BRAND.text}`}>
          Sound familiar?
        </p>
        <div className="mt-8 space-y-8">
          {lines.map((line, i) => (
            <blockquote
              key={i}
              className="text-2xl md:text-3xl font-light italic text-slate-800 leading-snug"
            >
              "{line}"
            </blockquote>
          ))}
        </div>
        <p className="mt-12 text-slate-500">
          If any of those are you — keep reading. We built this for you.
        </p>
      </div>
    </section>
  );
}

/* ──────────────────── Section 4: What FlipQuik Does ─────────────────────── */

function WhatItDoes() {
  const features = [
    {
      icon: Camera,
      title: 'Unlimited QuikEvals',
      body: "Scan an item and instantly see what it's worth, what it'll sell for, and where to list it.",
    },
    {
      icon: TrendingUp,
      title: 'Real eBay sold comps',
      body: 'See actual sold prices — not the wishful-thinking listings.',
    },
    {
      icon: BarChart3,
      title: 'Profit & loss tracking',
      body: 'Every sale auto-calculates your real net after fees, shipping, and supplies.',
    },
    {
      icon: Package,
      title: 'Unlimited inventory & listings',
      body: "No 25-item ceilings. Track everything you own and everything you've sold.",
    },
  ];
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        {/* Visual placeholder */}
        <div className="aspect-[4/3] rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
          <div className="text-center px-6">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-60" />
            <p className="text-sm">
              Product screenshot goes here.<br />
              Suggest: dashboard with one annotation arrow.
            </p>
          </div>
        </div>

        {/* Copy */}
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            The reseller app that does the math for you
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            Most reseller "tools" are inventory trackers with extra buttons.
            FlipQuik is built around one question:{' '}
            <em>am I actually making money?</em>
          </p>
          <ul className="mt-8 space-y-5">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4">
                <div className={`flex-shrink-0 mt-1 ${BRAND.text}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{f.title}</p>
                  <p className="text-slate-600 text-sm mt-0.5">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm italic text-slate-500">
            Plus: a profit dashboard, sales analytics, CSV export, and
            priority AI processing on Pro.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Section 5: Free Resources (Lead Magnet) ────────────── */

function FreeResources() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLeadCapture = async (e) => {
    e.preventDefault();
    // Basic email validation
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      // Inserts into public.leads. RLS on the table allows anon inserts but
      // blocks anon reads, so the email goes to the DB safely.
      // The actual welcome-sequence emails go out from your ESP (Klaviyo /
      // Mailchimp / ConvertKit), which should be wired to read from this
      // table on a schedule or via a webhook trigger.
      const { error } = await supabase
        .from('leads')
        .insert({ email: trimmed, source: 'landing-page-playbook' });

      if (error) {
        // Postgres unique-violation code = duplicate email.
        // Treat as a soft success — they're already on the list.
        if (error.code === '23505') {
          toast.success("You're already on the list — check your inbox for the guide.");
          setEmail('');
          return;
        }
        throw error;
      }

      toast.success("On its way — check your inbox in a minute.");
      setEmail('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Lead capture error', err);
      toast.error("Couldn't send the guide. Try again in a sec?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="free-resources" className={`py-24 ${BRAND.bgSoft}`}>
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
          Start free. Today.
        </h2>
        <p className="mt-3 text-slate-600 text-lg">
          Two free tools to start tracking your real profit before you ever sign up.
        </p>

        <div className="mt-12 grid md:grid-cols-2 gap-6 text-left">
          <ProductCard
            title="The Reseller's Profit Playbook"
            body="22 pages. The pricing formula most resellers get wrong, 50 categories that sell, and the 7-day audit that finds your profit leaks."
            visualLabel="Playbook cover mockup"
            icon={FileText}
          />
          <ProductCard
            title="The Profit Tracker spreadsheet"
            body="Every sale, every fee, every stale listing flagged. The companion to the Playbook."
            visualLabel="Tracker preview"
            icon={BarChart3}
          />
        </div>

        <form
          onSubmit={handleLeadCapture}
          className="mt-12 max-w-xl mx-auto flex flex-col sm:flex-row gap-3"
        >
          <label htmlFor="lead-email" className="sr-only">Email address</label>
          <div className="flex-1 relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Where should we send them?"
              className={`w-full pl-11 pr-4 py-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${BRAND.ring} focus:border-transparent`}
              required
              autoComplete="email"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className={`${BRAND.bg} ${BRAND.bgHover} text-white px-6 py-3`}
          >
            {submitting ? 'Sending…' : 'Send me both →'}
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          One email gets you both. No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
}

function ProductCard({ title, body, visualLabel, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 flex gap-5">
      <div className="flex-shrink-0 w-20 h-24 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">
          {visualLabel}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────── Section 6: Pricing ────────────────────────── */

function Pricing({ onCtaClick }) {
  const PRO_FEATURES = [
    'Unlimited QuikEvals & MultiEvals',
    'Unlimited inventory & listings',
    'Real eBay sold comps (unblurred, live data)',
    'Sales tracking with profit/loss',
    'Performance dashboard & analytics',
    'CSV & PDF export',
    'Priority AI processing',
  ];
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
          Simple pricing. No surprises.
        </h2>

        <div className="mt-12 rounded-2xl border-2 border-emerald-200 bg-white shadow-sm p-8 text-left">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            FlipQuik Pro
          </p>
          <p className="mt-2 text-5xl font-bold text-slate-900">
            $19<span className="text-xl text-slate-500 font-normal">/month</span>
          </p>
          <ul className="mt-6 space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-slate-700">
                <Check className={`h-5 w-5 mt-0.5 flex-shrink-0 ${BRAND.text}`} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            onClick={onCtaClick}
            className={`mt-8 w-full ${BRAND.bg} ${BRAND.bgHover} text-white font-semibold`}
          >
            Start free trial <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="mt-3 text-center text-xs text-slate-500">
            Two weeks free. Cancel anytime.
          </p>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Free tier available too — 3 QuikEvals/day, 25 inventory items,
          blurred eBay comps. Try it before you upgrade.
        </p>

        {/* Comeback callout */}
        <div className="mt-10 inline-flex items-center gap-3 rounded-full bg-amber-50 border border-amber-200 px-5 py-3 text-sm text-amber-900">
          <Heart className="h-4 w-4 text-amber-600" />
          <span>
            <strong>Recently laid off?</strong> Pro is free for 90 days.{' '}
            <Link
              to="/comeback"
              className="underline underline-offset-2 hover:text-amber-700 font-semibold"
            >
              Learn about the Comeback Plan →
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Section 7: Founder Story (B) ───────────────────── */

function FounderStory() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-5 gap-12 items-center">
        {/* Photo placeholder */}
        <div className="md:col-span-2">
          <img
            src="/sally-founder.jpg"
            alt="Sally, founder of FlipQuik"
            className="aspect-square w-full rounded-2xl object-cover shadow-sm"
            loading="lazy"
          />
        </div>

        {/* Body */}
        <div className="md:col-span-3">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Why I built this
          </h2>
          <div className="mt-6 space-y-5 text-slate-700 text-lg leading-relaxed">
            <p>
              I started reselling on lunch breaks. I needed extra income — for
              the family, for the bills that don't wait — and reselling looked
              manageable around a full-time job. I'd hit a thrift store between
              meetings, drag a bag home, and try to figure out what everything
              was worth that night.
            </p>
            <p>
              I was bad at it. I kept losing money on shipping I forgot to
              count. Pricing items using outdated comps from Google Lens.
              Spending three hours photographing things that ended up netting
              me $4 each — except I never did that math, so I didn't know.
            </p>
            <p>
              I built FlipQuik because I needed something that worked the way I
              worked: in scraps of time, late at night, with kids in the next
              room.
            </p>
            <p>
              Then I realized: every reselling tool out there is built by
              software companies for full-time resellers. None of them were
              built for the rest of us — the people fitting this around real
              life. So I made one.
            </p>
            <p>
              Whether you're trying to pay off a debt, build savings, or just
              stop bleeding money on a hustle that's costing more than it
              earns — I built this for you.
            </p>
          </div>
          <p className="mt-6 text-slate-700 italic">— Sally, founder</p>
          {/* TODO: add signature graphic when ready */}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Section 8: Trust / Social Proof ────────────────────── */

function TrustSocialProof() {
  // Per brief: hidden until we have something to put here.
  // Wired up structurally so flipping SHOW_SOCIAL_PROOF to true is enough.
  const SHOW_SOCIAL_PROOF = false;
  if (!SHOW_SOCIAL_PROOF) {
    return null;
  }
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <blockquote className="text-xl italic text-slate-800">
          "I'd been reselling for 8 months and had no idea I was barely
          breaking even. FlipQuik showed me the truth in one afternoon."
        </blockquote>
        <p className="mt-4 text-slate-500">— [Name], reseller for [time]</p>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 9: Final CTA ───────────────────────── */

function FinalCta({ onCtaClick }) {
  return (
    <section className={`${BRAND.bgGradient} text-white py-20`}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
          Stop guessing. Start tracking.
        </h2>
        <p className="mt-4 text-lg text-emerald-50/90">
          Two-week free trial of FlipQuik Pro. No card required. No commitment.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Button
            size="lg"
            onClick={onCtaClick}
            className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold px-6"
          >
            Start free trial
          </Button>
          <a
            href="#free-resources"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-md border border-white text-white hover:bg-white/10 font-semibold"
          >
            Get the free Playbook
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Footer ─────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
        <div>
          <p className="font-bold text-white text-xl tracking-tight">
            <span className="text-emerald-400">Flip</span>Quik
          </p>
          <p className="mt-3 text-sm text-slate-400">
            The reseller profit app for busy people.
          </p>
        </div>
        <FooterCol
          title="Product"
          items={[
            { label: 'Pricing', href: '#pricing' },
            { label: 'Features', href: '#features' },
            { label: 'The Comeback Plan', href: '/comeback' },
            { label: 'Free Playbook', href: '#free-resources' },
          ]}
        />
        <FooterCol
          title="Company"
          items={[
            { label: "Founder's note", href: '#founder' },
            { label: 'Contact', href: 'mailto:hello@flipquik.com' },
            { label: 'Press / Media kit', href: '/press' },
          ]}
        />
        <FooterCol
          title="Resources"
          items={[
            { label: 'Reseller Profit Playbook (PDF)', href: '#free-resources' },
            { label: 'Profit Tracker (spreadsheet)', href: '#free-resources' },
            { label: 'TikTok', href: 'https://tiktok.com/@flipquik' },
            { label: 'Instagram', href: 'https://instagram.com/flipquik' },
          ]}
        />
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
          <p>© 2026 FlipQuik. Built by a working parent, for working parents. flipquik.com</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-slate-300">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-300">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              className="hover:text-white"
              target={it.href.startsWith('http') ? '_blank' : undefined}
              rel={it.href.startsWith('http') ? 'noreferrer' : undefined}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
