import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FREE_LIMIT = 30;           // max calls per free user per window
const PRO_LIMIT = 200;           // max calls per pro/max user per window
const WINDOW_HOURS = 24;         // rolling window length

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase env vars not configured for edge function');
    }
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY secret is not set in Supabase');
    }

    // ── Identify caller ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client bypasses RLS for usage bookkeeping & profile lookup
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Determine tier-specific limit ──────────────────────────────────
    // Mirrors the Pro/Max detection in src/pages/QuikEval.jsx
    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_pro, plan_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    const isPro = !!(
      profile?.is_pro ||
      profile?.plan_tier === 'pro' || profile?.plan_tier === 'max' ||
      profile?.subscription_status === 'pro' || profile?.subscription_status === 'max'
    );
    const limit = isPro ? PRO_LIMIT : FREE_LIMIT;
    const tier = isPro ? 'pro' : 'free';

    // ── Rate-limit check (rolling 24h window) ──────────────────────────
    const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await adminClient
      .from('quikeval_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', windowStart);

    if (countErr) throw countErr;

    const used = count ?? 0;
    if (used >= limit) {
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: `QuikEval ${tier} limit reached (${limit} per ${WINDOW_HOURS} hours). Try again later.`,
          limit,
          used,
          tier,
          window_hours: WINDOW_HOURS,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // ── Anthropic call (unchanged behavior) ────────────────────────────
    const { prompt, base64_images, response_json_schema } = await req.json();

    const schemaHint = response_json_schema
      ? '\n\nRespond with valid JSON only. No markdown code fences, no extra text — just the raw JSON object.'
      : '';

    // Build content: images first so Claude sees them before reading the prompt
    const content: unknown[] = [];
    if (Array.isArray(base64_images) && base64_images.length > 0) {
      for (const b64 of base64_images) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
        });
      }
    }
    content.push({ type: 'text', text: prompt + schemaHint });

    const systemPrompt = `You are an expert resale pricing assistant. Apply these pricing rules strictly on every evaluation:

MODEL IDENTIFICATION — CRITICAL
- When you can see a model number, SKU, UPC, or variant name in the image, you MUST include it in the product title (item_name). Different models of the same product often have very different resale values. Always distinguish between variants. For example, use 'Pulsetto LITE Model PLST' instead of just 'Pulsetto Vagus Nerve Stimulator.'
- When the model number is NOT visible, note this in your response so the user knows the identification is at the brand/product-family level, not the specific SKU level.

MARKING & PROVENANCE
- If an item is unmarked, unbranded, or the maker is unknown, ALL price comps must be sourced from unmarked/unbranded examples only — never from named or marked versions of the same item type.
- Never average marked and unmarked examples together. They are different markets.
- Always state explicitly in your response whether your pricing is based on marked or unmarked sold comps.

PRICE DEFINITIONS
- resale_low: Realistic floor price for an item in similar condition that sells quickly (within days). Use actual low-end sold comps, not asking prices.
- resale_high: Best-case price assuming excellent condition, patient selling, and ideal platform placement (30+ days on market).
- suggested_resale_price: The realistic price a seller should expect to receive within 2 weeks on eBay given the item's actual condition.

CONDITION & ANTIQUES/COLLECTIBLES
- For antiques, glassware, ceramics, silver, and other collectibles: explicitly note if condition issues such as cloudiness, chips, haziness, crazing, repairs, or wear push the value toward the low end of the range.
- Do not assign high-end prices to items with visible condition issues unless those issues are irrelevant to value for that category.

EBAY SEARCH QUERY
- In addition to item_name, return a field called ebay_search_query — an optimized search string for finding this exact item's sold listings on eBay.
- This should include the specific model number/variant if identified, use terms eBay sellers commonly use in listing titles, and exclude generic words that would broaden results.
- Optionally include exclusion terms with a minus sign (e.g., '-V2' to exclude a different variant).
- If you cannot determine the specific model, set ebay_search_query to the same value as item_name.

GENERAL
- Base all estimates on realistic sold comps from eBay, Poshmark, Mercari, and similar platforms within the past 12 months.
- Be conservative. Never inflate prices. A wrong high estimate wastes the seller's time and money.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json();
    const rawText: string = anthropicData.content?.[0]?.text ?? '';

    // Parse JSON — strip any accidental markdown fences
    let result: unknown;
    try {
      const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      // Last-ditch: find the first {...} block
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        throw new Error('AI response was not valid JSON: ' + rawText.slice(0, 200));
      }
    }

    // Record successful call for rate-limit accounting. Failures above
    // throw before reaching this line, so only successes consume budget.
    // Logged & swallowed: a bookkeeping error shouldn't fail the user's call.
    const { error: insertErr } = await adminClient
      .from('quikeval_usage')
      .insert({ user_id: user.id });
    if (insertErr) console.error('[quikeval] usage insert failed', insertErr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quikeval]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
