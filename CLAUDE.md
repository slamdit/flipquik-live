\# FlipQuik — Claude Code Briefing



\## Project

\- App: FlipQuik reseller app at flipquik.com

\- Stack: React + Vite + Tailwind + shadcn/ui

\- Database: Supabase (project ID: hqvgawvtgwbbvedruwly)

\- Hosting: Vercel → auto-deploys on git push to master

\- Auth: Supabase Auth (email + password)



\## Supabase Tables That EXIST

items, sales, item\_photos, profiles, marketplace\_listings,

marketplace\_accounts, platform\_templates, expenses, mileage\_trips, actions



\## Tables That DO NOT EXIST — Never Reference These

\- listing\_drafts ❌

\- drafts ❌



\## Correct Column Names in 'items' Table

brand, category, color, condition, cost, created\_at, days\_listed,

id, internal\_notes, name, notes, price, primary\_photo\_url,

purchase\_location, resale\_high, resale\_low, search\_text, size,

status, storage\_location, suggested\_price, updated\_at, user\_id



\## Column Name Rules — ALWAYS Use These

\- Item title/name → name (NOT title, NOT item\_name)

\- Description → notes (NOT description)

\- List price → price (NOT list\_price)

\- Purchase price → cost (NOT purchase\_price)

\- Photo URL → primary\_photo\_url (NOT photo\_url)

\- Date added → created\_at (NOT created\_date)



\## Item Status Values (ONLY these four are valid)

\- draft

\- clipped

\- listed

\- flipped



\## Rules for Every Task

\- One task at a time

\- Always set status field when saving to items table

\- Never use Base44 patterns or reference Base44

\- Always push to master branch (not main)

\- Test changes before committing

\- After editing, always git add + git commit + git push origin master



\## Core User Flow

QuikEval (photo + AI eval) → Flip It (edit + save) → Inventory (manage)

\- Clip It = save with status 'clipped'

\- List It = save with status 'listed'

\- After successful save → redirect to home page '/'

