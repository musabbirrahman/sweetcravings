# Sweet Cravings — Homemade Desserts Storefront & Operations Dashboard

> **“A Little Sweetness, A Lot of Happiness.”**  
> **“একটু মিষ্টি, অনেকটা আনন্দ।”**  
> *Rajshahi, Bangladesh*

An artisanal, mobile-first bilingual dessert storefront and operations management system tailored for **Sweet Cravings** in Rajshahi.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and a zero-latency ACID relational SQLite database powered by Node.js native `node:sqlite`.

---

## 🍮 Features & Architecture

### 1. Customer Storefront
- **Bilingual Experience (English & বাংলা)**: Instant language switch with persistent preference remembering. Authentic Bengali translations across all pages, allergen warnings, lead times, and button actions.
- **Brand Visuals**: Warm chocolate brown, caramel amber, cream vanilla, and rich golden borders crafted around the official Sweet Cravings emblem logo.
- **Curated Dessert Catalog**:
  - *Signature Caramel Custard Flan* (Brand Hero showstopper with amber caramel cascade)
  - *Royal Chocolate Fudge Cake* (Dense chocolate sponge with Belgian dark chocolate ganache)
  - *Lotus Biscoff Layered Jar Cake* (Biscoff biscuit crumble with velvety cream cheese mousse)
  - *Classic Italian Tiramisu Cup* (Espresso-dipped ladyfingers with mascarpone cream)
  - *Rajshahi Special Mango Cream Delight* (Local mango puree with light sponge & condensed milk)
  - *Shahi Pistachio & Saffron Firni* (Slow-simmered Chinigura rice pudding in earthen clay cups)
  - *Red Velvet Strawberry Cupcakes* (Box of 4 tied with elegant ribbon)
- **Interactive Cart & Drawer**:
  - Live quantity adjustment, item removal, and subtotal calculation in BDT (৳).
  - Dynamic free delivery threshold progress banner (e.g. *Free delivery above ৳1200 across Rajshahi*).
- **Guest Checkout**:
  - Zero login friction (no account required to buy).
  - Customer name & Bangladesh mobile format verification (`01[3-9]XXXXXXXX`).
  - Rajshahi specific delivery dropdown: Shaheb Bazar, Kazihata, Upashahar, Talaimari, Motihar/RU Campus, Padma Residential, Laxmipur, Bornali, Shiroil, Sagarpara, Binodpur, Court Area, and Other.
  - Special delivery instructions & requested delivery time/date notes.
  - **Server-Side Pricing Recalculation**: Server re-evaluates all line items, variant deltas, and delivery fees directly from the database; never trusts client-submitted money.
  - **Idempotency Protection**: Tapping submit multiple times on mobile connections never creates duplicate orders.
- **Payment Workflows**:
  - **Cash on Delivery (COD)**: Record cash collected at doorstep.
  - **Manual bKash & Nagad**: Displays seller account numbers with one-tap copy, account type (*Personal Send Money* / *Merchant*), step-by-step instructions, and optional Transaction ID (TrxID) input.
- **Order Confirmation & Tracking**:
  - Human-friendly public order code (e.g., `SC-78241`).
  - Real-time 6-stage order timeline (*New → Accepted → Baking Fresh → Ready → Out for Delivery → Delivered*).
  - TrxID post-submission: Customers who pay later can submit or update their bKash/Nagad TrxID on the order page anytime.
  - Verified privacy tracking at `/track`: Requires Order Reference + Phone Number to prevent unauthorized order inspection.
  - Direct WhatsApp link prefilled with non-sensitive order reference.

---

### 2. Operator Dashboard for the Sister (`/admin`)
- Accessible via `/admin`, protected by a password set through the `ADMIN_PASSWORD` environment variable (see `.env.example`). There is no default password — admin login is disabled until one is set.
- **"What Needs My Attention?" Today Dashboard**:
  - Unreviewed new orders count with quick accept.
  - Pending bKash/Nagad payment submissions waiting for bank app verification.
  - Active in-kitchen and out-for-delivery counter.
- **Emergency Kitchen Capacity Switch**:
  - One-click toggle between **"Accepting Orders"** and **"Kitchen Busy / Orders Paused"** to halt checkout when kitchen capacity is full.
- **Orders Manager (`/admin/orders`)**:
  - One readable order per smartphone screen.
  - One-tap **Call Customer** (`tel:`) and **WhatsApp** prefilled chat.
  - Single-click order status progression.
  - Payment status changer: Verify & Confirm TrxID, record Cash Collected, or Reject.
  - Complete chronological audit log of all status transitions.
- **Products & Menu Editor (`/admin/products`)**:
  - Quick toggle for *Available* vs *Sold Out*.
  - Add / edit dessert modal with bilingual names, descriptions, lead times, allergens, prices, and variant options.
  - **Safe Soft Archive**: Archiving a discontinued dessert never breaks historical order records.
- **Settings & One-Click Backup (`/admin/settings`)**:
  - Configure flat delivery fee, free delivery threshold, and Rajshahi coverage statement.
  - Update bKash and Nagad numbers and account types with double-confirmation prompt before publishing.
  - Toggle COD on/off.
  - **One-Click Data Backup (JSON)**: Instant download of all orders, items, events, products, and audit logs.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

# 3. Open in your browser
http://localhost:3000
```

- Public Storefront: `http://localhost:3000`
- Menu: `http://localhost:3000/menu`
- Track Order: `http://localhost:3000/track`
- Admin Operations Portal: `http://localhost:3000/admin` (requires `ADMIN_PASSWORD` to be set — see `.env.example`)

> **Deployment is not decided yet.** The site currently runs locally with its built-in SQLite file (`data/sweetcravings.db`). The Turso code and migration script are leftovers from the starter and are not wired in — the app does not use them. Do not deploy to Vercel Hobby for this shop (see the blueprint); decide the deployment shape first.
