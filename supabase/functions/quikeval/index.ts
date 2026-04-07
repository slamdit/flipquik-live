import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, base64_images, response_json_schema } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY secret is not set in Supabase');
    }

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
