# FlipQuik

A mobile-first resale assistant for thrift flippers. Snap a photo, get instant resale intel, and manage your inventory from purchase to sale.

## Stack

- React + Vite
- Supabase (auth, database, storage, edge functions)
- Anthropic Claude (vision-based item evaluation via `quikeval` edge function)
- Tailwind CSS + shadcn/ui

## Getting started

1. Clone the repo
2. Install dependencies: `npm install`
3. Create `.env.local` with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run locally: `npm run dev`

## Edge functions

The `quikeval` Supabase edge function calls the Anthropic API. Deploy it with:

```
supabase functions deploy quikeval
```

Set the `ANTHROPIC_API_KEY` secret in your Supabase project settings.
