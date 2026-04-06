import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Exchanges the eBay authorization code for access + refresh tokens
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { code } = await req.json();

        if (!code) {
            return Response.json({ error: 'Missing authorization code' }, { status: 400 });
        }

        const EBAY_CLIENT_ID = Deno.env.get('eBayClientID');
        const EBAY_CLIENT_SECRET = Deno.env.get('eBayCertID');
        // eBay OAuth uses the RuName as the redirect_uri for token exchange
        const EBAY_REDIRECT_URI = Deno.env.get('eBayRuName') || 'YOUR_PRODUCTION_RUNAME_HERE';

        const credentials = btoa(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`);

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: EBAY_REDIRECT_URI,
        });

        const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('eBay token exchange error:', JSON.stringify(data));
            return Response.json({ error: data.error_description || 'Token exchange failed' }, { status: 400 });
        }

        // Save tokens to the user record
        await base44.auth.updateMe({
            ebay_access_token: data.access_token,
            ebay_refresh_token: data.refresh_token,
            ebay_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});