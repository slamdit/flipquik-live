import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Heart,
  Check,
  ChevronDown,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * /comeback — The Comeback Plan dedicated landing page.
 *
 * Brief: /TikTok Assets/Comeback-Plan-Page-Copy.md
 *
 * Per the brief: "The single most important conversion driver on this page is
 * the founder story in Section 2." Keep that section verbatim — do not shorten.
 *
 * Honor-system checkbox (referenced in the brief's implementation notes) lives
 * in the signup form, NOT on this page. TODO before launch:
 *   - Add "I'm claiming this through The Comeback Plan (recently laid off)"
 *     checkbox to /login signup form.
 *   - On submit with the box checked, set profiles.comeback_plan_active = true
 *     and profiles.comeback_plan_started_at = now() (server-side, in the
 *     existing post-signup hook or in a new edge function).
 */

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

export default function Comeback() {
  const navigate = useNavigate();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'The Comeback Plan — 90 days of FlipQuik Pro, free';

    const META_DESCRIPTION =
      "Recently laid off? FlipQuik gives you 90 days of full Pro access, free. No card required, honor system. From a founder who's been there.";

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
    ensureMeta('property', 'og:title', 'The Comeback Plan — 90 days of FlipQuik Pro, free');
    ensureMeta('property', 'og:description', META_DESCRIPTION);
    ensureMeta('property', 'og:type', 'website');
    ensureMeta('property', 'og:url', 'https://flipquik.com/comeback');
    // TODO: replace with the Comeback-specific OG image (founder photo + "The Comeback Plan" overlay)
    ensureMeta('property', 'og:image', 'https://flipquik.com/og-image-comeback.png');
    ensureMeta('name', 'twitter:card', 'summary_large_image');
    ensureMeta('name', 'twitter:title', 'The Comeback Plan — 90 days of FlipQuik Pro, free');
    ensureMeta('name', 'twitter:description', META_DESCRIPTION);
    ensureMeta('name', 'twitter:image', 'https://flipquik.com/og-image-comeback.png');

    return () => {
      document.title = previousTitle;
    };
  }, []);

  // CTA handler — sends user to signup with a query flag so the form can
  // pre-check the "I've been recently laid off" box on arrival.
  const handleClaim = () => navigate('/login?comeback=1');

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <PublicNav />
      <Hero onClaim={handleClaim} />
      <WhyThisExists />
      <WhatYouGet />
      <HowToClaim />
      <DayNinety />
      <FAQ />
      <FinalCta onClaim={handleClaim} />
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
          <Link to="/" className="hover:text-slate-900">Home</Link>
          <Link to="/#features" className="hover:text-slate-900">Features</Link>
          <Link to="/#pricing" className="hover:text-slate-900">Pricing</Link>
        </nav>
        <Link
          to="/"
          className="inline-flex items-center text-sm text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
      </div>
    </header>
  );
}

/* ───────────────────────────── Section 1: Hero ───────────────────────────── */

function Hero({ onClaim }) {
  return (
    <section className={`${BRAND.bgGradient} text-white pt-32 pb-24`}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur border border-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
          <Heart className="h-3.5 w-3.5" /> For the recently laid off
        </div>
        <h1 className="mt-6 text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
          The Comeback Plan
        </h1>
        <p className="mt-5 text-xl md:text-2xl text-emerald-50/90">
          90 days of FlipQuik Pro, free. From a founder who's been there.
        </p>
        <p className="mt-6 text-base md:text-lg text-emerald-50/80 max-w-xl mx-auto">
          If you've been recently laid off, FlipQuik is yours for the next 90
          days — full Pro access, no card required, no strings.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            onClick={onClaim}
            className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold px-8 py-6 text-base"
          >
            Claim 90 days free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="mt-3 text-sm text-emerald-50/80">
            No card. No questions. Honor system.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 2: Why this exists ─────────────────── */

function WhyThisExists() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-5 gap-12 items-center">
        <div className="md:col-span-2">
          <div className="aspect-square rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
            <div className="text-center px-6">
              <p className="text-sm">
                Founder photo goes here.<br />
                Or top-down hands-only shot.
              </p>
            </div>
          </div>
        </div>
        <div className="md:col-span-3">
          <p className={`text-xs tracking-widest uppercase font-semibold ${BRAND.text}`}>
            From the founder
          </p>
          <div className="mt-6 space-y-5 text-slate-700 text-lg leading-relaxed">
            <p>
              I started building FlipQuik when I was reselling on lunch breaks
              trying to make money work around a job and a family.
            </p>
            <p className="text-slate-900 font-semibold">Then I lost the job.</p>
            <p>
              So I know exactly what it feels like to look at a side hustle and
              wonder if you can turn it into something real before the savings
              run out. The math is brutal when you're not sure what's actually
              working.
            </p>
            <p>
              The Comeback Plan is what I would have wanted: 90 days of the
              full toolkit, free, while I figured it out. No proof, no
              paperwork. Just a clear runway to test if reselling can actually
              pay something back.
            </p>
            <p>
              If that's where you are right now — this is for you.
            </p>
          </div>
          <p className="mt-6 text-slate-700">
            <span className="italic">— Sally</span>
            <br />
            <span className="text-sm text-slate-500">Founder, FlipQuik</span>
          </p>
          {/* TODO: add signature graphic when ready */}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 3: What you get ────────────────────── */

function WhatYouGet() {
  const features = [
    {
      title: 'Unlimited evaluations',
      body: "Scan any item. See its real eBay sold price, what to ask, and where to list it. No daily caps.",
    },
    {
      title: 'Real eBay sold comps',
      body: 'Not blurred teasers. Actual prices items are selling for, right now. The single most important data point in this business.',
    },
    {
      title: 'Profit & loss tracking',
      body: "Every sale auto-calculates your real net after fees, shipping, and supplies. Know if you're actually making money — within hours, not months.",
    },
  ];
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center">
          What's in the 90 days
        </h2>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white border border-slate-200 p-6"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${BRAND.bgSoft} ${BRAND.text} mb-4`}>
                <Check className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-slate-600 italic max-w-3xl mx-auto">
          Plus: unlimited inventory & listings, performance dashboard,
          CSV/PDF export, sales analytics, priority AI processing.
        </p>
        <p className="mt-4 text-center font-semibold text-slate-900">
          Everything in the Pro tier. Same product, same access. Just free for 90 days.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 4: How to claim ────────────────────── */

function HowToClaim() {
  const steps = [
    {
      n: '1',
      title: 'Sign up at flipquik.com',
      body: 'Use your email. No credit card needed.',
    },
    {
      n: '2',
      title: 'Check the box',
      body: 'On signup, check the box that says "I\'ve been recently laid off." That\'s it. No paperwork, no proof, no questions.',
    },
    {
      n: '3',
      title: 'Start using it',
      body: "Full Pro access activates immediately. You'll get the most out of it if you go all-in: source something this week, list it, log it, and let the dashboard show you what's actually working.",
    },
  ];
  return (
    <section className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center">
          How to claim it
        </h2>
        <ol className="mt-12 space-y-8">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-5">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full ${BRAND.bg} text-white font-bold flex items-center justify-center`}>
                {s.n}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-slate-600 leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className={`mt-12 rounded-2xl ${BRAND.bgSoft} border border-emerald-200 p-6 flex gap-4`}>
          <Heart className={`h-6 w-6 ${BRAND.text} flex-shrink-0 mt-0.5`} />
          <div>
            <p className="font-semibold text-slate-900">
              The honor system is part of the design.
            </p>
            <p className="mt-2 text-slate-700 leading-relaxed">
              We trust you. Don't make us regret it. The Comeback Plan exists
              because the people who need it most shouldn't have to prove their
              pain to a form.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 5: Day 90 ──────────────────────────── */

function DayNinety() {
  const options = [
    {
      title: 'Convert to Pro',
      price: '$19/month',
      body: 'Same access, same features. Cancel anytime. No long-term contract.',
      tone: 'primary',
    },
    {
      title: 'Cancel',
      price: '$0',
      body: 'Drop to the Free tier. Your account stays active, but with daily caps and blurred eBay comps. No charge.',
      tone: 'neutral',
    },
    {
      title: 'Apply to The Comeback Crew',
      price: '$0 forever',
      body: "If you've been actively using FlipQuik and want to keep it free beyond day 90, you can apply to The Comeback Crew. You post 10 short videos a month showing how you use FlipQuik on social — and Pro stays free as long as you do. Plus you earn commission on paid signups from your videos.",
      tone: 'accent',
      link: { href: '/crew', label: 'Learn more about the Crew →' },
    },
  ];
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center">
          What happens at day 90
        </h2>
        <p className="mt-4 text-center text-slate-600 max-w-2xl mx-auto">
          You'll get reminder emails at day 60, day 75, and day 85 — so day 90
          doesn't sneak up on you. When the 90 days end, you'll have three
          choices:
        </p>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {options.map((o) => (
            <div
              key={o.title}
              className={`rounded-2xl border p-6 flex flex-col h-full ${
                o.tone === 'primary'
                  ? 'border-emerald-200 bg-white'
                  : o.tone === 'accent'
                  ? 'border-amber-200 bg-amber-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p
                className={`text-xs uppercase tracking-wider font-semibold ${
                  o.tone === 'accent' ? 'text-amber-700' : BRAND.text
                }`}
              >
                {o.title}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{o.price}</p>
              <p className="mt-3 text-slate-600 text-sm leading-relaxed flex-1">{o.body}</p>
              {o.link && (
                <Link
                  to={o.link.href}
                  className="mt-4 inline-flex items-center text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  {o.link.label}
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          No surprise charges. We'll always email you before any billing kicks in.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 6: FAQ ─────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: 'What counts as "recently laid off"?',
    a: "Anyone who's been laid off in the last 12 months. Honor system applies — we don't ask for proof.",
  },
  {
    q: 'What if I quit my job, or got fired for cause?',
    a: "The Comeback Plan was designed for people who lost their job through no fault of their own (layoffs, restructuring, role elimination). If you quit voluntarily or were terminated for cause, it's not the right fit — but the Free tier is open to anyone, and Pro is just $19/month if you decide to upgrade.",
  },
  {
    q: 'Can I use the Comeback Plan more than once?',
    a: 'Each person can claim it once per 18 months. If you used it last year and got laid off again — yes, you can claim it again.',
  },
  {
    q: "What if I'm in a different country?",
    a: 'The Comeback Plan is available worldwide. Every feature works the same.',
  },
  {
    q: 'Will my card be charged at day 90?',
    a: "No card is taken on signup. At day 90, if you choose to convert, you'll go through Stripe checkout. If you don't choose anything, your account drops to the Free tier — no charge.",
  },
  {
    q: 'Is this a scam?',
    a: "Fair question — these days, free things are usually traps. This isn't one. The math: SaaS marginal cost is near-zero. People who use FlipQuik for 90 days during a hard moment are people I want using it forever. The 10–20% who convert to Pro at day 90 (or stay on through the Crew) more than cover the cost. It's good business and it's the right thing. Both true at the same time.",
  },
  {
    q: 'What if I have other questions?',
    a: 'Email me directly: sally@flipquik.com. I read every email.',
    isEmail: true,
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <section className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center">
          Frequently asked questions
        </h2>
        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full py-5 flex items-center justify-between text-left gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-slate-900">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-500 flex-shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="pb-6 text-slate-700 leading-relaxed">
                    {item.isEmail ? (
                      <p>
                        Email me directly:{' '}
                        <a
                          href="mailto:sally@flipquik.com"
                          className={`${BRAND.text} hover:text-emerald-700 underline underline-offset-2 inline-flex items-center gap-1`}
                        >
                          <Mail className="h-4 w-4" />
                          sally@flipquik.com
                        </a>
                        . I read every email.
                      </p>
                    ) : (
                      <p>{item.a}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section 7: Final CTA ───────────────────────── */

function FinalCta({ onClaim }) {
  return (
    <section className={`${BRAND.bgGradient} text-white py-20`}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
          90 days. Full access. No card.
        </h2>
        <p className="mt-4 text-lg text-emerald-50/90">
          If reselling can become an income, you'll know within 90 days.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            onClick={onClaim}
            className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold px-8 py-6 text-base"
          >
            Claim my 90 days <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="mt-3 text-sm text-emerald-50/80">
            Join in under 2 minutes. Just an email and a checkbox.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Footer ─────────────────────────────────── */
/* Mirror of Landing's footer. TODO: extract into <PublicFooter /> in
   src/components/ so both pages share one source of truth. */

function Footer() {
  const cols = [
    {
      title: 'Product',
      items: [
        { label: 'Pricing', href: '/#pricing' },
        { label: 'Features', href: '/#features' },
        { label: 'The Comeback Plan', href: '/comeback' },
        { label: 'Free Playbook', href: '/#free-resources' },
      ],
    },
    {
      title: 'Company',
      items: [
        { label: "Founder's note", href: '/#founder' },
        { label: 'Contact', href: 'mailto:hello@flipquik.com' },
        { label: 'Press / Media kit', href: '/press' },
      ],
    },
    {
      title: 'Resources',
      items: [
        { label: 'Reseller Profit Playbook (PDF)', href: '/#free-resources' },
        { label: 'Profit Tracker (spreadsheet)', href: '/#free-resources' },
        { label: 'TikTok', href: 'https://tiktok.com/@flipquik' },
        { label: 'Instagram', href: 'https://instagram.com/flipquik' },
      ],
    },
  ];
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
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold text-white">{c.title}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {c.items.map((it) => (
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
        ))}
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
