import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const EBAY_CLIENT_ID = Deno.env.get("eBayClientID");

        if (!EBAY_CLIENT_ID) {
            return Response.json({ error: 'eBayClientID not configured as a secret.' }, { status: 500 });
        }

        // eBay OAuth uses the RuName as the redirect_uri parameter
        const EBAY_REDIRECT_URI = Deno.env.get('eBayRuName') || 'YOUR_PRODUCTION_RUNAME_HERE';

        const scopes = [
            'https://api.ebay.com/oauth/api_scope',
            'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
            'https://api.ebay.com/oauth/api_scope/sell.inventory',
            'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
            'https://api.ebay.com/oauth/api_scope/sell.account',
            'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
            'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
            'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
            'https://api.ebay.com/oauth/api_scope/sell.marketing',
        ].join(' ');

        const authUrl = 'https://auth.ebay.com/oauth2/authorize' +
            '?client_id=' + encodeURIComponent(EBAY_CLIENT_ID) +
            '&response_type=code' +
            '&redirect_uri=' + encodeURIComponent(EBAY_REDIRECT_URI) +
            '&scope=' + encodeURIComponent(scopes);

        return Response.json({ authUrl });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});