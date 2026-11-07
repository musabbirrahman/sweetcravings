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

## The shop pages (what a customer sees)
- `/` home, `/menu` all desserts, `/cart` the basket, `/checkout`
  name, phone, address, area, payment choice, `/order/[code]` the
  confirmation page, `/track` look up an order (code + phone)

## How an order works
1. The basket lives in the browser only (remembered on the phone).
2. Checkout sends the items to `POST /api/orders`. The server — not the
   browser — looks up the real prices, adds the delivery fee, applies
   any coupon, and saves the order. A repeat tap cannot create a second.
3. Payment is never taken on the site. For bKash/Nagad the customer
   pays in their own wallet app, then pastes the transaction ID. The
   sister checks her wallet app and marks it confirmed or rejected.
4. Status moves: new → accepted → preparing → ready → out for
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
- Products: add/edit desserts, prices, photos (web links), sold out
- Settings: delivery fee, wallet numbers, WhatsApp, homepage text,
  coupons, and a one-click backup download of all orders
- One shared admin password (set in `.env.local`). No separate
  accounts and no second login step yet.

## The database
- One file: `data/sweetcravings.db` (SQLite — a simple file database).
  The app creates it fresh, with the menu, the first time it starts.

## Where things live in the code
- `src/app/` the pages; `src/app/api/` the server endpoints
- `src/lib/db.ts` database, starting menu, coupons, loyalty
- `src/lib/auth.ts` admin password check and login sessions
- `src/lib/translations.ts` all English and Bangla words on the site
- `src/components/` visible pieces (menu cards, basket, stamp card)
- `src/context/` the basket and the language switch (English/Bangla)
- `src/middleware.ts` the guard that keeps `/admin` behind login
- `scripts/turso-migrate.mjs` a leftover Turso script — NOT used.
  Deployment is undecided; the app always uses the local database
  file, so it must not go on a host that throws files away.