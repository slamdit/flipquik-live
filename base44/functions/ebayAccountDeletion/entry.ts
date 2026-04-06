import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// eBay Marketplace Account Deletion Notification Handler
// Required by eBay for GDPR compliance
Deno.serve(async (req) => {
    // eBay sends a GET request to verify the endpoint
    if (req.method === 'GET') {
        const url = new URL(req.url);
        const challengeCode = url.searchParams.get('challenge_code');
        
        if (challengeCode) {
            const VERIFICATION_TOKEN = (Deno.env.get('EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN') || '').trim();
            // Must exactly match what is entered in the eBay developer portal endpoint field
            const ENDPOINT_URL = 'https://flipquik.base44.app/api/functions/ebayAccountDeletion';
            
            console.log('Challenge code:', challengeCode);
            console.log('Endpoint URL used for hash:', ENDPOINT_URL);
            console.log('Token length:', VERIFICATION_TOKEN.length);
            console.log('Token value:', VERIFICATION_TOKEN);
            console.log('Hash input:', challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL);
            
            // eBay requires: SHA-256 hash of (challengeCode + verificationToken + endpoint)
            const encoder = new TextEncoder();
            const data = encoder.encode(challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const challengeResponse = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            console.log('Challenge response:', challengeResponse);
            return Response.json({ challengeResponse });
        }
    }

    // eBay sends a POST request when an account is deleted
    if (req.method === 'POST') {
        const body = await req.json();
        console.log('eBay account deletion notification received:', JSON.stringify(body));
        // You can add logic here to handle the deletion (e.g. remove user data)
        return new Response(null, { status: 200 });
    }

    return new Response('Method not allowed', { status: 405 });
});