# Stripe Integration Summary

## Overview

Provocations uses Stripe Checkout for one-time payments (e.g., "Buy a Coffee"). The integration follows a redirect-based Checkout flow: the server creates a Stripe Checkout Session, redirects the user to Stripe's hosted payment page, and receives the result via a webhook.

---

## Replit Secrets (Environment Variables)

All Stripe credentials are stored as **Replit Secrets** (never committed to source):

| Secret Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY_PROD` | Server-side Stripe SDK authentication |
| `STRIPE_PUBLISHABLE_KEY_PROD` | Client-facing publishable key (reserved for future client-side use) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification (starts with `whsec_`) |
| `STRIPE_BUY_COFFEE_PRICE_ID` | Price ID for the default product |

The Stripe SDK is initialized server-side only:

```typescript
// server/routes.ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_PROD);
```

---

## API Endpoints

### `GET /api/stripe/config`

Returns available products and prices from Stripe for the pricing page.

- **Auth**: Requires Clerk authentication
- **Response**: `{ products: StripeProduct[] }`
- **Source**: `server/routes.ts:4503-4527`

### `POST /api/stripe/create-checkout-session`

Creates a Stripe Checkout Session and returns the hosted payment URL.

- **Auth**: Requires Clerk authentication
- **Body**: `{ priceId: string }` (validated by `createCheckoutSessionSchema` in `shared/schema.ts`)
- **Response**: `{ sessionUrl: string }`
- **Behavior**:
  1. Creates a Stripe Checkout Session in `payment` mode
  2. Inserts a `pending` payment record in the `payments` table
  3. Returns the Stripe-hosted URL for redirect
- **Redirect URLs**: `/pricing?success=true` and `/pricing?canceled=true`
- **Source**: `server/routes.ts:4530-4566`

### `POST /api/stripe/webhook`

Receives asynchronous event notifications from Stripe.

- **Auth**: **Exempted** from Clerk auth (Stripe signs the payload instead)
- **Body**: Raw JSON (parsed via `express.raw()`, not `express.json()`)
- **Signature verification**: Uses `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`
- **Source**: `server/routes.ts:4570-4613`

### `GET /api/stripe/payments`

Returns the authenticated user's payment history.

- **Auth**: Requires Clerk authentication
- **Response**: `{ payments: PaymentRecord[] }` ordered newest-first
- **Source**: `server/routes.ts:4616-4627`

---

## Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Updates payment status to `completed`; stores `stripeCustomerId`, `stripePaymentIntentId`, `amount`, `currency` |
| `checkout.session.expired` | Updates payment status to `failed` |

### Webhook Middleware

The webhook requires special Express middleware because Stripe signature verification needs the **raw request body**:

```typescript
// server/index.ts
app.use((req, res, next) => {
  if (req.path === "/api/stripe/webhook") {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json({ limit: "5mb" })(req, res, next);
  }
});
```

The webhook path is also exempted from Clerk auth middleware:

```typescript
app.use("/api", (req, _res, next) => {
  if (req.path === "/clerk-config" || req.path === "/stripe/webhook") {
    return next();
  }
  return requireAuth()(req, _res, next);
});
```

---

## Database Schema

**Table**: `payments` (defined in `shared/models/chat.ts:253-272`, auto-created by `server/db.ts`)

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL` | Primary key |
| `user_id` | `VARCHAR(128)` | Clerk user ID (indexed) |
| `stripe_session_id` | `VARCHAR(256)` | Checkout Session ID (indexed) |
| `stripe_customer_id` | `VARCHAR(256)` | Set on completion |
| `stripe_payment_intent_id` | `VARCHAR(256)` | Set on completion |
| `product_id` | `VARCHAR(256)` | Stripe Product ID |
| `price_id` | `VARCHAR(256)` | Stripe Price ID |
| `amount` | `INTEGER` | Amount in cents |
| `currency` | `VARCHAR(8)` | e.g., `usd` |
| `status` | `VARCHAR(32)` | `pending` / `completed` / `failed` |
| `created_at` | `TIMESTAMP` | Auto-set |
| `updated_at` | `TIMESTAMP` | Auto-set |

Storage methods in `server/storage.ts:888-921`:
- `createPayment()` — insert a new pending record
- `updatePaymentBySessionId()` — update status and Stripe metadata after webhook
- `getPaymentsByUserId()` — list user's payments

---

## Frontend

**Pricing page**: `client/src/pages/Pricing.tsx` — routed at `/pricing`

- Fetches products from `/api/stripe/config`
- Renders product cards with name, description, and price
- Initiates checkout via `/api/stripe/create-checkout-session` and redirects to Stripe
- Displays success/canceled banners based on URL query params
- Linked from workspace header via a CreditCard icon button

---

## Key Files

| File | Role |
|---|---|
| `server/routes.ts` | All four Stripe endpoints |
| `server/index.ts` | Raw body middleware + auth exemption for webhook |
| `server/storage.ts` | Payment DB operations |
| `shared/models/chat.ts` | `payments` table definition + Zod schema |
| `shared/schema.ts` | `createCheckoutSessionSchema` validation |
| `client/src/pages/Pricing.tsx` | Pricing UI |
| `client/src/App.tsx` | `/pricing` route |
| `script/build.ts` | Stripe in build externals |
