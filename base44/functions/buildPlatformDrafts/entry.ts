import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLATFORM_CONFIG = {
  poshmark:           { titleMaxLen: 80,  platform_url: 'https://poshmark.com',              displayName: 'Poshmark' },
  mercari:            { titleMaxLen: 40,  platform_url: 'https://www.mercari.com',            displayName: 'Mercari' },
  depop:              { titleMaxLen: 50,  platform_url: 'https://www.depop.com',              displayName: 'Depop' },
  grailed:            { titleMaxLen: 60,  platform_url: 'https://www.grailed.com',            displayName: 'Grailed' },
  etsy:               { titleMaxLen: 140, platform_url: 'https://www.etsy.com',              displayName: 'Etsy' },
  facebook_marketplace: { titleMaxLen: 100, platform_url: 'https://www.facebook.com/marketplace', displayName: 'Facebook Marketplace' },
  whatnot:            { titleMaxLen: 60,  platform_url: 'https://www.whatnot.com',            displayName: 'Whatnot' },
  ebay:               { titleMaxLen: 80,  platform_url: 'https://www.ebay.com',              displayName: 'eBay' },
};

const PLATFORM_STYLE_PROMPTS = {
  poshmark:   'Poshmark style: warm, social tone. Use 1-2 relevant emojis in title. Include "bundle for discount" CTA. Max 80 char title.',
  mercari:    'Mercari style: clean, simple, no emojis. Very concise title under 40 chars. Bullet-point style description.',
  depop:      'Depop style: trendy Gen-Z tone. Use hashtags at end of description. Casual language, can use slang. Emojis OK.',
  grailed:    'Grailed style: designer-focused, sophisticated tone. Emphasize brand authenticity. "Serious buyers only." Clean and minimal.',
  etsy:       'Etsy style: SEO keyword-rich title. Descriptive, vintage/handmade angle if applicable. Include material/size in title.',
  facebook_marketplace: 'Facebook Marketplace style: casual and local. Mention "local pickup available." Friendly, conversational tone.',
  whatnot:    'Whatnot style: auction/live-sell energy. Emphasize rarity or collectibility. Create excitement. Short punchy title.',
  ebay:       'eBay style: keyword-optimized title with brand, model, condition. Factual description with specs. No fluff.',
};

function applyTemplate(template, item) {
  if (!template) return null;
  const replace = (str) => (str || '')
    .replace(/{brand}/g, item.brand || '')
    .replace(/{item_name}/g, item.item_name || '')
    .replace(/{condition}/g, item.condition || '')
    .replace(/{size}/g, item.size || '')
    .replace(/{color}/g, item.color || '');
  return {
    title: template.title_template ? replace(template.title_template) : null,
    description: template.description_template ? replace(template.description_template) : null,
  };
}

function applyPricingStrategy(basePrice, template) {
  if (!template || template.pricing_strategy === 'use_master_price') return basePrice;
  if (template.pricing_strategy === 'round_up') return Math.ceil(basePrice);
  if (template.pricing_strategy === 'round_down') return Math.floor(basePrice);
  if (template.pricing_strategy === 'percentage_adjustment') {
    const pct = parseFloat(template.price_adjustment_percent || 0);
    return Math.round(basePrice * (1 + pct / 100) * 100) / 100;
  }
  return basePrice;
}

async function generateWithAI(base44, item, platform, photos) {
  const stylePrompt = PLATFORM_STYLE_PROMPTS[platform] || '';
  const cfg = PLATFORM_CONFIG[platform];
  const fileUrls = photos.map(p => p.processed_photo || p.original_photo).filter(Boolean).slice(0, 4);

  const prompt = `You are an expert reseller helping list items on multiple marketplaces.
Generate an optimized listing for ${cfg.displayName}.

Style guide: ${stylePrompt}

Item details:
- Name: ${item.item_name || 'Unknown'}
- Brand: ${item.brand || 'N/A'}
- Category: ${item.category || 'N/A'}
- Condition: ${item.condition || 'N/A'}
- Size: ${item.size || 'N/A'}
- Color: ${item.color || 'N/A'}
- Notes: ${item.notes || item.master_description || 'N/A'}
- Master Title: ${item.master_title || 'N/A'}

Return JSON with:
- title: optimized listing title (max ${cfg.titleMaxLen} chars, strictly enforce this)
- description: listing description following platform style

Return only valid JSON, no markdown.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'gemini_3_flash',
    file_urls: fileUrls.length > 0 ? fileUrls : undefined,
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
      },
    },
  });

  return {
    title: (result.title || '').substring(0, cfg.titleMaxLen),
    description: result.description || '',
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { item_id, platforms } = await req.json();
  if (!item_id || !platforms?.length) return Response.json({ error: 'item_id and platforms required' }, { status: 400 });

  const items = await base44.entities.Item.filter({ id: item_id });
  const item = items[0];
  if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });

  // Load user templates and photos
  const [userTemplates, photos] = await Promise.all([
    base44.entities.PlatformTemplate.filter({ user_id: user.id }),
    base44.entities.ItemPhoto.filter({ item_id }, 'sort_order', 6),
  ]);

  const templateMap = Object.fromEntries(userTemplates.map(t => [t.platform, t]));
  const basePrice = item.suggested_price || item.purchase_price || 0;

  const results = [];

  for (const platform of platforms) {
    const cfg = PLATFORM_CONFIG[platform];
    if (!cfg) continue;

    const userTemplate = templateMap[platform];

    // Build title + description (user template > AI generation)
    const fromTemplate = applyTemplate(userTemplate, item);
    let platform_title, platform_description;

    if (fromTemplate?.title && fromTemplate?.description) {
      // Full user template
      platform_title = fromTemplate.title.substring(0, cfg.titleMaxLen);
      platform_description = fromTemplate.description;
    } else {
      // AI generation
      const ai = await generateWithAI(base44, item, platform, photos);
      platform_title = fromTemplate?.title ? fromTemplate.title.substring(0, cfg.titleMaxLen) : ai.title;
      platform_description = fromTemplate?.description || ai.description;
    }

    const platform_price = applyPricingStrategy(basePrice, userTemplate);

    // Upsert MarketplaceListing
    const existingListings = await base44.entities.MarketplaceListing.filter({ item_id, platform, user_id: user.id });
    let listing;
    if (existingListings.length > 0) {
      listing = await base44.entities.MarketplaceListing.update(existingListings[0].id, {
        listing_status: 'draft_prepared',
        publish_mode: 'assisted',
        platform_title,
        platform_description,
        platform_price,
        last_sync_at: new Date().toISOString(),
      });
      listing = { ...existingListings[0], listing_status: 'draft_prepared', platform_title, platform_description, platform_price };
    } else {
      listing = await base44.entities.MarketplaceListing.create({
        user_id: user.id,
        item_id,
        platform,
        listing_status: 'draft_prepared',
        publish_mode: 'assisted',
        platform_title,
        platform_description,
        platform_price,
        last_sync_at: new Date().toISOString(),
      });
    }

    // Create action task (only if not already pending)
    const existingActions = await base44.entities.MarketplaceAction.filter({
      item_id,
      platform,
      action_type: 'publish',
      action_status: 'pending',
    });

    if (existingActions.length === 0) {
      await base44.entities.MarketplaceAction.create({
        user_id: user.id,
        item_id,
        marketplace_listing_id: listing.id,
        platform,
        action_type: 'publish',
        action_status: 'pending',
        priority: 'medium',
        action_title: `Post on ${cfg.displayName}`,
        action_instructions: `Your draft is ready. Copy the title and description, upload your photos, set the price to $${platform_price}, and publish. Then tap "Mark Complete".`,
        deep_link_url: cfg.platform_url,
      });
    }

    results.push({ platform, listing_id: listing.id, platform_title, platform_price });
  }

  await base44.entities.Item.update(item_id, {
    distribution_status: results.length === platforms.length ? 'partially_distributed' : 'partially_distributed',
    is_crosslisted: true,
  });

  return Response.json({ success: true, results });
});