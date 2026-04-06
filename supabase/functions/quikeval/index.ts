import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, file_urls = [], response_json_schema } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY secret is not set in Supabase');
    }

    // Build message content — images first, then the text prompt
    const content: unknown[] = [];

    for (const url of file_urls) {
      if (url && typeof url === 'string') {
        content.push({
          type: 'image',
          source: { type: 'url', url },
        });
      }
    }

    const schemaHint = response_json_schema
      ? '\n\nRespond with valid JSON only. No markdown code fences, no extra text — just the raw JSON object.'
      : '';

    content.push({ type: 'text', text: prompt + schemaHint });

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
