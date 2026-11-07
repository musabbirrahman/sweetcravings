# Sweet Cravings — Code Map (plain words)

A small online shop for homemade desserts in Rajshahi. Customers browse
desserts, order as guests (no account), and pay by cash on delivery or
by sending money through bKash / Nagad and sharing the transaction ID.
The sister runs it from an admin area on her phone.

## How to run it
- `npm install`, then `npm run dev`, open http://localhost:3000
- Admin login lives at `/admin`. Its password comes from a file called
  `.env.local` (line: `ADMIN_PASSWORD='...'`). No password file, no login.
  That file stays on your own computer and is never uploaded to GitHub.
- The live site runs on Cloudflare Workers (free, never sleeps — see
  DEPLOY.md). The commands for that are `npm run build:cf` (build the
  Worker version), `npm run preview` (try it locally in the Workers
  runtime) and `npm run deploy` (put it live).

## The shop pages (what a customer sees)
- `/` home, `/menu` all desserts, `/menu/[name]` one dessert on its own
  shareable page (photo, sizes, ingredients, batch left, add to bag),
  `/cart` the basket, `/checkout` name, phone, address, area, payment
  choice, `/order/[code]` the confirmation page, `/track` look up an
  order (code + phone). The confirmation page has a Download Receipt
  button: it saves a one-page-style PDF (`Sweet-Cravings-SC-XXXXX.pdf`)
  built from an off-screen receipt card (`src/components/OrderReceipt.tsx`)
  with html2canvas + jsPDF — the browser draws the Bangla text, so the
  letters keep their proper joined shapes in the file. There is no print
  button; printing the page is not a receipt.

## How an order works
1. The basket lives in the browser only (remembered on the phone).
2. Checkout sends the items to `POST /api/orders`. The server — not the
   browser — looks up the real prices, adds the delivery fee, applies
   any coupon, and saves the order. A repeat tap cannot create a second.
3. Payment is never taken on the site. For bKash/Nagad the customer
   pays in their own wallet app, then pastes the transaction ID. The
   sister checks her wallet app and marks it confirmed or rejected.
4. Each dessert has a daily batch limit (usually 15). The server
   counts what sold today and refuses an order past the limit — the
   number shown on the site is only the display; the check is on
   the server.
5. Status moves: new → accepted → preparing → ready → out for
   delivery → completed (or cancelled). Every change is logged.

## Coupons and loyalty (both checked on the server)
- A coupon is a code with a discount, a minimum order, and a use
  limit. The discount is always worked out on the server.
- Loyalty: every 5 completed orders earns one ৳150 reward. The code
  only works for a phone number with an unused reward earned —
  typing it without earning it is refused.
- Loyalty details need the full 11-digit phone number.

## The admin area (`/admin`, sister only)
- Today: new orders, unpaid wallet payments, pause-the-kitchen switch
- Orders: open one, call/WhatsApp the customer, change status/payment
- Products: add/edit desserts, prices, photos, sold out. Every field
  can be changed on an existing dessert — name, category, price,
  sizes, photo, lead time, ingredients, allergen note, availability.
  Photos can be uploaded from the phone (JPG/PNG/WebP, under 5 MB —
  shrunk to at most 1200px wide in the browser before upload) or pasted in as a web
  link. Closing a pop-up window (the X, tapping outside it, or the
  Escape key) throws away unsaved changes.
- Categories: a separate tab where new food categories are created
  (English + Bangla name — the web address is made from the English
  name), edited, archived, or deleted. A category with desserts in it
  cannot be deleted; archive it instead. A new category shows up in
  the dessert form and on the menu straight away.
- Settings: delivery fee, wallet numbers, WhatsApp, homepage text,
  coupons, and a one-click backup download of all orders. A backup
  file can also be restored from here — it is checked first, and
  restoring replaces all menu, orders and settings (coupons stay).
  Old uploaded photos are never deleted automatically.
- One shared admin password (set in `.env.local`). No separate
  accounts and no second login step yet.

## The database and uploaded photos
- The app can use two databases, picked by one setting
  (`TURSO_DATABASE_URL` in `.env.local`):
  - Empty: one file, `data/sweetcravings.db` (SQLite — a simple file
    database). The app creates it fresh, with the menu, the first
    time it starts. This is local development.
  - Set: a Turso cloud database, through the same code
    (`src/lib/db.ts` + `src/lib/turso.ts`). This is the live site on
    Cloudflare Workers, which has no disk that keeps files. The first
    start creates the tables and the menu there too.
- Uploaded dessert photos: on the live site the photo bytes are kept
  in the database itself (a `product_images` table) and shown by
  `GET /api/images/[id]` — a Worker has nowhere else to keep them.
  Locally (no Turso setting) they are still saved as files in
  `public/uploads/products/` on the same computer as the database.
  One local quirk: a photo uploaded to that folder only shows on the
  site after the local server is restarted. Neither the database nor
  the photos are ever uploaded to GitHub.

## Where things live in the code
- `src/app/` the pages; `src/app/api/` the server endpoints
- `src/lib/db.ts` database, starting menu, coupons, loyalty — it
  speaks to the local file or to Turso through one small surface,
  so the rest of the app never sees which one is active
- `src/lib/turso.ts` the Turso connection (address + token from the
  environment); empty address means the local file
- `src/lib/auth.ts` admin password check and login sessions
- `src/lib/translations.ts` all English and Bangla words on the site
- `src/components/` visible pieces (menu cards, basket, stamp card)
- `src/context/` the basket and the language switch (English/Bangla)
- `src/middleware.ts` the guard that keeps `/admin` behind login
- `scripts/turso-migrate.mjs` creates the tables on a fresh Turso
  database (`npm run db:turso-sync`). Run it once, before the first
  deploy — see DEPLOY.md.
- `wrangler.jsonc` + `open-next.config.ts` the Cloudflare Worker
  setup (the adapter that turns this Next.js app into a Worker).
  Photos are served without the image service: `next/image` runs
  unoptimized (see `next.config.js`), because that service is billed
  separately and there is no payment method on file.