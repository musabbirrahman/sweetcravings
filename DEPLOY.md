# Deploying Sweet Cravings — Cloudflare Workers + Turso (free)

The live site runs on **Cloudflare Workers** (the shop code) with a
**Turso** cloud database. Both are free and need **no payment card**.
Cloudflare never sleeps, so there is no cold start for the first
customer and no keep-alive monitor is needed. Do the steps in order;
each one is short, and nothing here costs money.

What you need before you start: this repo on your computer with the
latest code (`git pull`), Node.js installed, and the two account
logins below (both free, both made with your own email).

---

## Step 1 — Create the Turso database (free)

1. Go to [turso.tech](https://turso.tech) and sign up (free — no card).
2. Create a database. Any name works; `sweetcravings` is the obvious one.
3. On the database page, copy two values:
   - **URL** — looks like `libsql://sweetcravings-<something>.turso.io`
   - **Auth token** — create one on the database page if it does not
     show one yet (a long string starting with `ey...`).
4. Keep them private. They are the keys to the shop's database: never
   paste them into GitHub, a chat, or a screenshot you share.

## Step 2 — Create the tables (one command)

In the repo folder, with the two values from step 1:

```bash
TURSO_DATABASE_URL="libsql://sweetcravings-<something>.turso.io" TURSO_AUTH_TOKEN="ey..." npm run db:turso-sync
```

(Windows PowerShell: set the two values with
`$env:TURSO_DATABASE_URL="..."` and `$env:TURSO_AUTH_TOKEN="..."`
first, then run `npm run db:turso-sync`.)

You should see `Schema & indexes synchronized successfully!` and
`Turso cloud database is ready!`. The menu, settings and coupons
seed themselves the first time the app starts, so there is nothing
else to load. Run this again any time after pulling a code update
that changes the tables — it only creates what is missing.

## Step 3 — Create the Cloudflare account and log in (free)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign
   up (free — no card).
2. On your computer, in the repo folder, log the command line in:

```bash
npx wrangler login
```

It opens a browser window; approve the login there and come back.
(`npx` runs the wrangler copy already installed with the project,
so there is nothing else to install.)

## Step 4 — Set the four values in the Cloudflare dashboard

In the Cloudflare dashboard, go to **Workers & Pages**, open the
Worker after the first deploy (step 5 creates it — set the values
right after that first deploy, then deploy once more), and under
**Settings → Variables**, add these four (type: secret for the two
passwords, plain text is fine for the URL):

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | The admin password (the same one as in your local `.env.local`). Single-quote it in `.env.local`; in the dashboard just paste the password itself. Never use `$` in it. |
| `NEXT_PUBLIC_BASE_URL` | The public address of the site, e.g. `https://sweet-cravings.<your-name>.workers.dev` (copy it from the Worker page after the first deploy). Set it in your local `.env.local` too **before** you deploy, because this address is baked into the site when it is built. |
| `TURSO_DATABASE_URL` | The URL from step 1. |
| `TURSO_AUTH_TOKEN` | The token from step 1. |

For a quick local preview first, copy `.dev.vars.example` to
`.dev.vars` and fill in the same four values — that file is only for
your computer and is never committed.

## Step 5 — Deploy

In the repo folder:

```bash
npm run deploy
```

This builds the site, turns it into a Worker, and uploads it. The
first deploy also creates the Worker named `sweet-cravings`. When it
finishes, it prints the address — something like
`https://sweet-cravings.<your-name>.workers.dev`. That is the live
site. (If step 4 was done after the first deploy, run
`npm run deploy` once more so the new values take effect.)

To check the size before deploying: `npm run build:cf` builds the
Worker locally. It must stay under the free-plan Worker size limit
(3 MiB compressed); this project measures about 1.2 MiB, so there is
plenty of room.

## Step 6 — Smoke-test the live site

Go through this once, in order, on the live address:

1. Browse the home page and a dessert page (`/menu/caramel-custard-flan`).
2. Add a dessert to the basket, check out as cash on delivery with
   your own name and phone, and note the order code (SC-…).
3. Open the order page, then look the same order up on `/track`
   (order code + the same phone number).
4. On the order page, press **Download Receipt** — a PDF should
   download (`Sweet-Cravings-SC-XXXXX.pdf`).
5. Log in at `/admin` with the admin password.
6. In **Products**, upload a photo for a dessert (JPG/PNG/WebP,
   under 5 MB — it is shrunk to at most 1200px wide in the browser
   before upload) and check the photo shows on that dessert's page.
7. In **Categories**, add one test category, then delete it again.

If any step fails, the fix is in the code, not in the accounts:
check the dashboard variables in step 4 first (a wrong token or a
missing password is the usual cause), then redeploy.

## Step 7 — Backups

- **Before the shop takes real orders**, download one backup from
  `/admin` → **Settings** → backup download, and keep the file
  somewhere safe (not only on the shop computer). Repeat weekly, or
  after any big menu change. The backup holds orders, menu, settings
  and coupons; photos are stored in the database, so they are covered
  by a Turso backup, not by this file.
- The admin area can also restore a backup file (Settings → restore).
  Restoring replaces the menu, orders and settings — coupons stay —
  so only restore a file you trust, and only when you mean it.

## Step 8 — A real domain (later, optional)

The free `https://sweet-cravings.<your-name>.workers.dev` address
works fine as the live site. A real domain (for example
`sweetcravings.com.bd`) can be pointed at the Worker later from the
Cloudflare dashboard (**Workers & Pages → the Worker → Settings →
Domains**): add the domain there and set its DNS to Cloudflare.
The shop already runs on Cloudflare, so there is nothing to move —
and the `NEXT_PUBLIC_BASE_URL` value must be updated to the new
address and the site redeployed when the domain changes.

---

## Free-tier limits to know about (checked November 2026)

**Turso free plan** (from Turso's own pricing page and docs):
- $0/month, no credit card. 100 databases, 5 GB storage,
  500 million rows read and 10 million rows written per month.
- If any single limit is passed, the databases are **blocked** until
  the month resets (or the plan is upgraded). This shop is far below
  those numbers — a few thousand orders a month is a rounding error
  against 500M reads — but do not use the shop database for anything
  else, and keep an eye on the Turso dashboard usage page.
- A free database is **archived after 10 days with no activity**.
  Any visit to the live site counts as activity, so a shop that gets
  orders never archives. If the shop is quiet for 10 days and then
  stops answering, unarchive it with the Turso CLI:
  `turso group unarchive <group-name>`. No data is lost by archiving.
- Turso announced on 2026-10-02 that Supabase is acquiring it; Turso
  says the service, databases, APIs and workflows continue as they do
  today.

**Cloudflare Workers free plan:**
- The Worker itself is free and never sleeps. The free-plan size
  limit is 3 MiB compressed; this project is about 1.2 MiB.
- Photos are stored in Turso, not in Cloudflare R2, because R2
  signup needs a payment method on file. Nothing in this project
  needs a paid Cloudflare service: images are served as-is
  (`next/image` runs unoptimized — product photos are already
  web-sized before upload), and there is no image-optimization or
  R2 binding in the Worker.

## If something goes wrong

- **Site shows an error on every page:** the database values are the
  usual suspect. Check `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
  in the dashboard (step 4), then redeploy.
- **Admin login always fails:** the `ADMIN_PASSWORD` value in the
  dashboard is not the one you think it is. Re-enter it (no `$` in
  the password), save, and redeploy.
- **Photos upload but never show:** the photo bytes live in Turso
  (table `product_images`, served by `/api/images/[id]`). If the
  database values are right, an upload that returns an error usually
  means the photo was over 1 MB after the browser resize — try a
  smaller photo.
- **The site worked, then stopped after a quiet spell:** see the
  Turso archive note above — unarchive the database.
- **Local development still works offline:** with no Turso values
  set, the app uses `data/sweetcravings.db` on your own computer
  (`npm run dev`). Photos then go to `public/uploads/products/` —
  and one local quirk: a photo uploaded there only shows on the
  site after the local server is restarted.
