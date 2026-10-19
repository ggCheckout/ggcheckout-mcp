# GG Checkout MCP Server

> Complete Model Context Protocol server for managing the GG Checkout platform via AI agents — 194 tools across 20 domains.

## Overview

The GG Checkout MCP server enables AI agents (Claude Code, Cursor, Claude Desktop) to manage the entire GG Checkout platform through natural language: products, checkouts, payments, members area, funnels, WhatsApp, billing, and more.

## Prerequisites

- Node.js >= 18.0.0
- A GG Checkout account with an active API Key

## Installation

### NPX (Recommended)

```bash
npx -y ggcheckout-mcp@latest
```

### Global Install

```bash
npm install -g ggcheckout-mcp
```

## Getting Your API Key

1. Visit [ggcheckout.com](https://www.ggcheckout.com/)
2. Go to **Settings** → **MCP / API Key**
3. Generate your API Key (format: `ggck_live_...`)
4. **Important:** Copy and save your API key immediately — it won't be shown again!

## Configuration

### Claude Code

> **Upgrading?** Use `ggcheckout-mcp@latest`, as in the snippet below: plain
> `npx -y ggcheckout-mcp` reuses whatever copy `npx` cached first and can keep you on an
> old version indefinitely. With `@latest`, restarting your MCP client picks up the newest
> release. That includes minor releases, which can carry breaking changes (0.3.0 changed
> `create_checkout` to take `productId` instead of `id`, and checkout reads return
> `productId` instead of `id`), so read [CHANGELOG.md](./CHANGELOG.md) first. To stay on a
> version, pin it, for example `ggcheckout-mcp@0.4.0`; you then have to update it by hand.

```json
{
  "mcpServers": {
    "ggcheckout": {
      "command": "npx",
      "args": ["-y", "ggcheckout-mcp@latest"],
      "env": {
        "GGCHECKOUT_API_KEY": "ggck_live_your_key_here"
      }
    }
  }
}
```

### Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Same format as above.

### Cursor / Other Clients

```bash
export GGCHECKOUT_API_KEY="ggck_live_your_key_here"
```

### Custom API URL

```bash
export GGCHECKOUT_API_URL="https://your-staging.example.com"
```

### Payments API (PIX charges)

The five payments-API tools (`list_wallets`, `create_pix_charge`, `get_payment_intent`,
`list_payment_intents`, `cancel_payment_intent`) use their own secret key, created in
**My wallet → API**. They are only registered when it is set, and `GGCHECKOUT_API_KEY` is never
used for them.

```bash
export GG_PAYMENTS_API_KEY="ggpk_test_your_key_here"   # ggpk_test_ = simulated, ggpk_live_ = real money
export GG_PAYMENTS_API_URL="https://api.ggcheckout.app/v1"   # optional, this is the default
```

The URL must be `https` (plain `http` is accepted only for `localhost` / `127.0.0.1`); the server
refuses to start otherwise.

### Upload folder

`upload_members_area_file` reads files from the machine running this server, and only from the
folder named here. Without it the tool refuses every upload: what an agent reads (a page, a PDF) can
carry instructions, so the server never reads an arbitrary path. A file that is itself a symbolic
link is refused, and a path that leads outside the folder through a link is too.

```bash
export GGCHECKOUT_UPLOAD_ROOT="/home/me/course-import"
```

### Versioning and the API

- Every request this server makes carries `User-Agent: ggcheckout-mcp/<version>` and
  `X-GG-MCP-Version: <version>`, so the API knows which release is calling.
- The API can refuse writes from versions below the minimum it supports. The refusal says so
  and asks you to update.
- On startup the server makes one quick, optional check of the npm registry. If a newer version
  is published, tool responses carry a short `update:` line so your assistant can suggest
  restarting the client. If the check fails or times out, nothing happens.
- Both APIs also tell an outdated install so in their response headers; the tool result then ends
  with a `⚠️ ggcheckout-mcp desatualizado (<current> → <latest>)` line. The version must be a newer
  semver and the command is always `npx -y ggcheckout-mcp@latest`: no header text is shown.

**For maintainers**

- Never remove or change the format of the `User-Agent` header: the API's version check reads it.
- Every release that changes what a write sends to the API must be considered as the new
  minimum supported version on the server, and that decision is recorded in the release's
  CHANGELOG entry.

---

## Available Tools (194)

### Products (18 tools)

#### `list_products`

List all your products/deliveries.

**Example prompt:** "Show me all my products"

#### `get_product`

Get details of a specific product.

**Parameters:** `productId` (string)

**Example prompt:** "Get details of product abc123"

#### `create_product`

Create a new product/delivery.

**Parameters:**
- `title` (string): Product title
- `description` (string): Product description
- `price` (number|string): Price in Reais (e.g., 19.90) or Brazilian format ("19,90")
- `discount` (number): Discount percentage (use 0 for no discount)
- `url` (string): Product delivery URL

**Example prompts:**
- "Create a product called 'React Course' priced at R$99.00 with delivery URL https://example.com/course"
- "Add a new product: 'Node.js Guide', R$49.90, no discount, url https://example.com/node"

#### `update_product`

Update an existing product. Only provide fields you want to change; everything else is kept.

**Parameters:** `productId` + any fields from create_product (all optional)

On accounts whose product read does not carry the file or the stock lines, an edit of a product
that delivers only one of those is refused with an explanation: the API checks the request body
for a deliverable, and those two cannot be read back to be sent along. Pass `url` with the
change, or make it in the dashboard.

**Example prompt:** "Update product abc123 price to R$79.90"

#### `delete_product`

**Example prompt:** "Delete product abc123"

#### `upload_deliverable` / `attach_deliverable` / `delete_deliverable`

Attaching a file takes two tool calls and one upload you perform yourself — the bytes never pass
through this server:

1. `upload_deliverable` (`productId`, `fileName`, `fileType`, `fileSize`) returns
   `{ uploadUrl, filePath }`.
2. `PUT` the raw bytes to `uploadUrl` with **only** `Content-Type: <fileType>` set. Do not send
   an `Authorization` header — the signature is already in the URL and an extra header breaks it.
   The URL is valid for one hour; the file may be up to 250MB.
3. `attach_deliverable` (`productId`, `filePath`, `fileName`, `fileType`, `fileSize`) confirms the
   upload landed and links it to the product.

`attach_deliverable` keeps any link (`url`) the product already has; when both exist, the file
is what the buyer receives.

`delete_deliverable` unlinks the file; pass `filePath` to delete the stored bytes as well. It is
refused when the file is the product's only deliverable, since the API will not save a product
with nothing to deliver: give it a `url` first. If the unlink works and the byte deletion does
not, the answer carries `fileDeleteError` and the product stays unlinked.

**Example prompt:** "Attach ebook.pdf (2MB, application/pdf) to product abc123"

#### `list_upsells` / `create_upsell` / `delete_upsell` / `reorder_upsells`

Manage upsells for a product.

**Example prompts:**
- "Show me the upsells for product abc123"
- "Create an upsell for product abc123 offering product xyz789 at R$29.90"
- "Reorder the upsells for product abc123"

#### `list_downsells` / `create_downsell` / `delete_downsell` / `reorder_downsells`

Manage downsells for a product.

**Example prompt:** "Add a downsell to product abc123 with a 50% discount headline"

#### `get_offer_snippets` / `set_offer_product_page` (offers on the seller's page)

The post-purchase funnel is one ordered sequence of products, and each product opens either on the
GG offer page or on the seller's own page ("Minha página"). Both can be mixed in the same funnel: the
funnel order decides where the buyer goes after accepting or declining, and each product opens on its
own kind of page.

- `set_offer_product_page` puts ONE product of an upsell or downsell on the seller's page (the page
  where its buttons are pasted, the two texts and the button color), or back on the GG page with
  `page: null` (the stored page is kept, so moving it back loses nothing).
- `get_offer_snippets` is read only: every product of the offer in funnel order, and for each one on
  the seller's page the HTML to paste there (the same as "Copiar HTML" in the dashboard) and the page
  it goes on. An agent with access to the seller's landing page can paste each snippet where the
  buttons should appear, keeping the `<script>` tag.

Each snippet works only for its own product, when the funnel order reaches it. Pages must be https;
plain http only works for localhost against a development server.

**Example prompt:** "Put the second product of upsell u1 of product abc123 on https://seller.com/oferta
with a green button saying 'Quero!', then give me the HTML to paste on that page"

#### `manage_tags`

Set tags on a product. Tags have a name and a hex color.

**Example prompt:** "Tag product abc123 with 'VIP' in purple and 'Featured' in green"

---

### Checkouts (6 tools)

#### `list_checkouts`

**Example prompt:** "Show me all my checkout pages"

#### `get_checkout`

**Example prompt:** "Get details of checkout abc123"

> **Note:** A checkout has two identifiers, and every response carries both. Its
> own is `uid` (Firestore document ID) — that is what `get_checkout`,
> `update_checkout`, `delete_checkout` and `manage_checkout_tags` take. The other
> is `productId`, a foreign key pointing at the product this checkout sells; the
> API names that field `id`, and the server renames it on the way in and out.

#### `create_checkout`

Creates an offer for a product that already exists.

**Required:** `title`, `productId`, `price`, `paymentMethods`, `checkout` (config)

`productId` must be the uid returned by `create_product` (or a `uid` from
`list_products`) — not a slug. A checkout created against a product that doesn't
exist is an orphan the dashboard cannot open, so this is validated before the
checkout is created.

`price` is in Reais (`99.90`) and is converted to the cents the API stores.
`orderBumps` takes product uids; each one is resolved and snapshotted into the
shape the checkout page reads, so a uid that does not exist fails the call
instead of silently vanishing from the page.

**Example prompt:** "Create a checkout page for my React Course priced at R$99.90"

#### `update_checkout`

Only provide the fields you want to change. The API keeps every field missing from
the body as stored, so the tool sends the checkout's identity (title, owner, product,
price) plus your changes and nothing else from the stored document.

**Example prompt:** "Update checkout abc123 price to R$79.90 and unpublish it"

#### `delete_checkout`

**Example prompt:** "Delete checkout abc123"

#### `manage_checkout_tags`

Tags with name and hex color (max 5 per checkout).

**Example prompt:** "Add a 'promo' tag with color #FF5733 to checkout abc123"

---

### Payments (7 tools)

#### `get_my_business_id`

**Example prompt:** "What is my business ID?"

**Pro Tip:** Use it in follow-up prompts: "Get my business ID, then show me all payments"

#### `list_payments` / `get_payments_paginated` / `get_payment`

**Example prompts:**
- "Show me all payments for my business"
- "Get the last 20 paid payments from this month"
- "Search for payments with email john@example.com"
- "How many pending payments do I have?"

#### `get_payment_fulfillment` / `update_payment_fulfillment`

Manage physical order fulfillment.

**Example prompts:**
- "Show the fulfillment status for payment xyz789"
- "Mark payment xyz789 as shipped with tracking code BR123456789"

#### `check_payment_status`

**Example prompt:** "Check the gateway status for payment xyz789"

---

### Webhooks (6 tools)

**Example prompts:**
- "Show me all my webhooks"
- "Create a webhook for pix.paid events at https://myapp.com/webhook"
- "Update webhook abc123 to also listen for card.paid"
- "Delete webhook abc123"
- "Send a test pix.paid event to webhook abc123"
- "Test my webhook abc123 with an expired event overriding the payment ID to pay_xyz"

#### Event names

The API stores the event names you register **without checking them**, and delivery matches
them exactly — so a name outside this list is accepted, saved, and never fires, with no error
anywhere. These are the names that exist:

| Family | Events |
|---|---|
| PIX | `pix.paid`, `pix.generated`, `pix.expired`, `pix.failed` |
| Card | `card.paid`, `card.generated`, `card.expired`, `card.failed`, `card.pending` |
| Subscription | `subscription.canceled`, `subscription.past_due`, `subscription.renewed` |
| Quiz funnel | `quiz.completed`, `quiz.lead_captured` |
| Cart | `checkout.abandoned` |

There is **no refund or chargeback event**: nothing dispatches one. `pix.failed` and
`card.pending` can be registered but have no emitter today. Names of the form
`payment.*` are the platform's internal vocabulary between services, not seller webhooks —
registering one gets you silence.

#### Webhook Event Payloads

All events share the same top-level shape. Key fields:

| Field | Type | Notes |
|---|---|---|
| `event` | string | Event type (see below) |
| `payment.id` | string | Payment identifier |
| `payment.status` | string | `pending`, `paid`, `expired` |
| `payment.method` | string | `pix`, `credit_card` |
| `payment.amount` | number | Amount in **cents** (e.g. `9900` = R$99,00) |
| `payment.customer.name` | string | Buyer name |
| `payment.customer.email` | string | Buyer email |
| `payment.customer.document` | string | CPF |
| `payment.customer.phone` | string | Phone (E.164, e.g. `5511999999999`) |
| `payment.createdAt` | string | ISO 8601 |
| `payment.paidAt` | string \| undefined | Present on `pix.paid` and `card.paid` |
| `payment.expiredAt` | string \| undefined | Present on `pix.expired` and `card.expired` |
| `product.id` | string | Product identifier |
| `product.title` | string | Product name |

**What `test_webhook` sends.** These bodies are built by the MCP server and posted straight to
your endpoint — the platform is not involved — so they are a plausible payment-shaped payload to
exercise your handler with, not a byte-for-byte copy of a live delivery:

```json
{ "event": "pix.paid",     "payment": { "status": "paid",    "method": "pix",         "paidAt": "..." }, ... }
{ "event": "card.paid",    "payment": { "status": "paid",    "method": "credit_card", "paidAt": "..." }, ... }
{ "event": "pix.expired",  "payment": { "status": "expired", "method": "pix",         "expiredAt": "..." }, ... }
{ "event": "card.expired", "payment": { "status": "expired", "method": "credit_card", "expiredAt": "..." }, ... }
```

**Signature verification** (when a `secret` is set):

```
X-Webhook-Signature: sha256=<HMAC-SHA256(secret, raw_body)>
X-GGCheckout-Event: pix.paid
```

```ts
import { createHmac } from 'crypto';
const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
const isValid = sig === incomingHeader.replace('sha256=', '');
```

---

### Store (28 tools)

`list_stores` returns your stores' ids; every other store tool takes one.

**Manage the store:** `create_store`, `get_store`, `update_store`, `delete_store`;
categories with `list_store_categories`, `create_store_category`, `update_store_category`,
`delete_store_category`; review moderation with `list_store_reviews`, `create_store_review`,
`update_store_review`, `delete_store_review`. `update_store` merges objects into the stored
config and replaces lists (`productOrder`, gateways, a category's `productIds`). Creating or
publishing a store requires a seller with verified email and phone.

**Store builder:** `get_store_layout`, `update_store_layout`, `publish_store_layout`,
`list_store_layout_history`, `restore_store_layout_version`, `get_store_theme`.
`update_store_layout` saves a draft and merges `theme`, `config` and `pageSettings` into the
stored ones; `blocks` replaces the whole list. Nothing is public until you publish.

**Catalog reads** (`get_store_public`, `list_store_products`, `get_store_product`,
`list_categories`, `list_feedbacks`) read the public storefront: they only see published
stores, list approved reviews only, and may be cached for up to 7 days.
`get_store_order` only returns pending orders with an API key.

Store integrations, store upsells/downsells, video, sales notifications and custom fields
are dashboard-only.

**Example prompts:**
- "Create a store called 'Loja Teste', turn on PIX with my AmploPay gateway and publish it"
- "Create a 'Cursos' category with products abc and def"
- "Approve all pending reviews of my store"
- "List my stores"
- "Change the primary color of my store to #8b5cf6 and publish it"
- "Undo the last store publish"
- "List all products in my store"
- "List customer reviews for my store with rating stats"
- "Validate coupon code SAVE20 for an order of R$100"

---

### Funnels / Quiz (10 tools)

A quiz is a funnel: `question` components with options and scores, `result` components,
`scoring.ranges` and conditional `flow.edges`. `update_funnel` merges `design` and `settings`
into the stored ones; `steps`, `flow` and `scoring` replace the stored value, so read the
funnel first and send the full array back. Pixels and webhooks are linked by id
(`settings.pixelTokenIds` from `list_tokens`, `settings.webhookIds` from `list_webhooks`).
`list_funnel_checkouts` gives the checkouts and gateways a `pix` component can use.

**Example prompts:**
- "List all my funnels"
- "Create a quiz with 3 questions that scores leads into beginner and advanced"
- "Change the primary color of funnel abc123 to red"
- "Send the leads of funnel abc123 to my Zapier webhook"
- "Duplicate funnel abc123"
- "Show me the leads from funnel abc123 that completed all steps"
- "Show me the drop-off analytics for each step in funnel abc123"

---

### Members Area (32 tools)

**Example prompts:**
- "List all my members areas"
- "Create a members area for product abc123 called 'React Academy'"
- "Add a module called 'Getting Started' to members area xyz"
- "Create a video lesson called 'Introduction' in section abc of module xyz"
- "Reorder the modules in members area xyz"
- "List all students in members area xyz"
- "Add student john@example.com to members area xyz"
- "Import these 50 students to members area xyz"
- "Block student abc123"

**Files the seller sends.** `upload_members_area_file` uploads a file that is already on the machine
running this server (an absolute path inside `GGCHECKOUT_UPLOAD_ROOT`, see "Upload folder") and
returns the URL to pass on:

| `kind` | Accepts | Use the `url` in |
|---|---|---|
| `image` | jpg, png, webp, gif, avif | `update_members_area` branding (logo, banner), module `imageUrl`, section and lesson `thumbnailUrl` |
| `video` | mp4, webm, mov, avi, mpeg — up to 500 MB | `create_lesson` type `video`: `videoUrl` and `content: { videoUrl, videoSourceType: "upload" }` |
| `file` | pdf, doc(x), xls(x), zip, rar, 7z, mp3, ogg, wav, images, videos — up to 100 MB; needs `areaId` | `create_pdf_lessons`, `create_lesson` `content.fileUrl`, or `add_lesson_attachment` |

Nothing is downloaded from another platform: videos and PDFs come from the seller. Modules and
sections take `dripSettings` (release N days after purchase, enrollment or first access); lessons
take a cover and a position. `update_module` / `update_section` / `update_lesson` change only the
fields sent, and `delete_module` / `delete_section` / `delete_lesson` remove the item with everything
under it — irreversible, so they take `confirm: true`. These six need the API release with the
`PATCH`/`DELETE` structure routes; an older deployment answers that it has no such route yet.

---

### Discounts / Coupons (6 tools)

**Example prompts:**
- "Show me all my discounts"
- "Create a 15% discount coupon called SAVE15 for all products"
- "Create a buy-2-get-1 discount for product abc123"
- "Deactivate discount abc123"
- "Validate coupon SAVE15 for an order with 2 items totaling R$200"

---

### WhatsApp (13 tools)

**Example prompts:**
- "List my WhatsApp sessions"
- "Create a new WhatsApp session called 'Sales'"
- "Get a pairing code for session abc123 with phone number 5511999999999"
- "List all message templates"
- "Create a template for the 'paid' event: 'Hi {nome}, thanks for purchasing {produto}!'"
- "Disable template abc123"
- "Check the WhatsApp delivery status for payment xyz789"
- "Resend the WhatsApp delivery for payment xyz789"
- "Send a message to 5511999887766 via session abc123: 'Hello!'"

---

### Billing (11 tools)

**Example prompts:**
- "What's my current billing balance?"
- "What's my billing status?"
- "Show me my invoices"
- "Pay invoice abc123 via PIX"
- "Add R$100 in billing credits"
- "Do I have a card on file?"
- "Remove my saved card"

---

### Shipping / MelhorEnvio (7 tools)

**Example prompts:**
- "Calculate shipping to CEP 01001-000 for checkout abc123"
- "Check the shipping status for payment xyz789"
- "Generate a shipping label for payment xyz789"
- "Get the print URL for shipping order abc123"

---

### Gateway Tokens (4 tools)

**Example prompts:**
- "List my payment gateway tokens"
- "Add a PushinPay token"
- "Remove token abc123"

`insert_token` creates only the four types the API accepts: `pushinpay`, `utmify`,
`emailprovider` and `mercadopago`. The platform processes payments through 25+ gateways, but the
others are connected from the dashboard, not through this API — asking for one here is refused.

---

### Discord (7 tools)

**Example prompts:**
- "List my Discord connections"
- "Show me the channels in server 123456"
- "Show me the roles in server 123456"
- "Create a private sales notification channel in server 123456"
- "Update my Discord connection to use Portuguese"

---

### Dashboard (3 tools)

**Example prompts:**
- "Show me my sales stats for today"
- "Show me the revenue chart for this month"
- "Refresh my dashboard cache"

---

### Custom Domains (5 tools)

**Example prompts:**
- "List my custom domains"
- "Add domain checkout.mysite.com"
- "Verify DNS for domain abc123"
- "Remove domain abc123"

---

### Rewards / Goals (2 tools)

**Example prompts:**
- "What's my progress on sales milestones?"
- "Redeem the 10K bracelet reward"

`calculate_rewards` is the only reader: it returns the progress and the milestone list together,
in reais (`currentRevenueCents` carries the same value in cents). There is no reward catalogue
endpoint, and a cache miss is rate limited to 10 per hour.

---

### Profile / Auth (6 tools)

**Example prompts:**
- "Show me my profile"
- "Update my name to 'John Doe'"
- "List my support emails"
- "Add support@mystore.com as a support email"
- "What's my KYC status?"

---

### Push Notifications (3 tools)

**Example prompts:**
- "List my registered push devices"
- "Remove device abc123"

---

### Telegram (15 tools)

Bots (`list_telegram_bots`, `get_telegram_bot`, `create_telegram_bot`, `update_telegram_bot`,
`delete_telegram_bot`, `validate_telegram_token`, `get_telegram_bot_groups`), flows
(`list_telegram_flows`, `get_telegram_flow`, `create_telegram_flow`, `update_telegram_flow`,
`delete_telegram_flow`, `deploy_telegram_flow`), `list_telegram_leads` and `telegram_media_upload`.

**Example prompts:**
- "List my Telegram bots"
- "Create a basic flow for bot abc123 and deploy it"
- "Show the qualified leads of bot abc123"

---

### Payments API (5 tools)

Requires `GG_PAYMENTS_API_KEY` (see Configuration). PIX only.

`list_wallets`, `create_pix_charge`, `get_payment_intent`, `list_payment_intents` (filters:
`status`, `external_reference`, `starting_after`, `limit`) and `cancel_payment_intent`.

`create_pix_charge` takes the wallet id (`wal_…`), the amount **in cents** (`4990` = R$ 49,90),
`description`, `external_reference`, `metadata` and the buyer (`buyer_name`, `buyer_email`,
`buyer_document`, `buyer_phone`: all four are required, the phone with 10 to 15 digits). With a `ggpk_live_` key it creates a **real** charge; with
`ggpk_test_` a simulated one. The response says which with `livemode` and carries the PIX in
`pix.copy_paste` / `pix.qr_base64`.

**Example prompts:**
- "List my wallets"
- "Create a R$ 49,90 PIX charge on wallet wal_8f3kQ2 for Maria Souza (maria@example.com, CPF 123.456.789-09, phone 11987654321)"
- "Did the charge for order 1234 get paid?"

---

## Price Formats

Prices are accepted in two formats:

1. **Reais (recommended):** `19.90` = R$19.90 → stored as `1990` cents
2. **Brazilian format:** `"19,90"` or `"1.990,00"`

All prices are stored internally in cents.

---

## Security Best Practices

🔒 **Never share your API key publicly**

✅ Always use environment variables
✅ Revoke compromised keys immediately
✅ Generate new keys periodically
❌ Don't hardcode keys in your code
❌ Don't commit keys to version control

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Per hour | 1,000 requests |
| Per minute | 30 requests |

Rate limits are enforced **before** any operation is executed — a blocked request never reaches the database or business logic.

When a request is rate limited, the API returns HTTP 429 with a `Retry-After` header and a structured JSON body:

**Header:**
```
Retry-After: 23
```

**Body:**
```json
{
  "error": "rate_limit_exceeded",
  "limit_type": "apikey_strict",
  "limit": 30,
  "window": "1m",
  "retry_after": 23
}
```

| `limit_type` | Limit | Window | What to do |
|---|---|---|---|
| `apikey_strict` | 30 | 1m | Wait `retry_after` seconds, then resume |
| `apikey` | 1,000 | 1h | Migration too large for one session — split into batches across hours |
| `product_upload_strict` | 15 | 1m | Slow down file uploads |
| `product_upload` | 35 | 1h | Max 35 file uploads per hour |

Always use the `retry_after` value from the body (or the `Retry-After` header) instead of guessing.

### Bulk operations and migrations

If you need to create or update many resources in sequence (e.g. importing products, cloning checkouts), follow these guidelines to avoid hitting the limits:

- **Space requests by at least 2 seconds** to stay safely under the 30 req/min limit
- **Cap sustained throughput at ~900 req/hour** to leave headroom below the 1,000/hour ceiling
- **On a 429 response**, stop immediately, read the `Retry-After` header, wait that many seconds, then resume — do not retry without waiting
- **Never loop without a delay** — tight loops will exhaust the per-minute quota in under 30 seconds and trigger a full minute of blocking

**Recommended pacing for bulk jobs:**

```
for each item:
  call tool()
  if response is 429:
    wait Retry-After seconds
    retry once
  else:
    wait 2 seconds before next call
```

---

## Local Development

```bash
git clone https://github.com/ggCheckout/ggcheckout-mcp.git
cd ggcheckout-mcp
npm install
```

### .env

```bash
GGCHECKOUT_API_KEY=ggck_live_your_key_here
GGCHECKOUT_API_URL=http://localhost:3000  # optional, defaults to https://ggcheckout.app
GGCHECKOUT_UPLOAD_ROOT=/path/to/import    # needed by upload_members_area_file, the only folder it reads from
```

### Commands

```bash
npm run dev          # Development with hot reload
npm run build        # TypeScript build
npm start            # Run compiled build
npm test             # Unit tests (173 tests)
npm run test:e2e     # E2E against staging (requires .env)
```

### MCP Inspector (Interactive UI)

```bash
GGCHECKOUT_API_KEY=ggck_live_... npx @modelcontextprotocol/inspector -- npx tsx src/index.ts
```

Opens a browser UI to test any tool interactively.

---

## Troubleshooting

### Error: 401 Unauthorized

- Check that your API key is correct
- Ensure the key starts with `ggck_live_`
- Verify the key hasn't been revoked in your dashboard

### Error: 403 Forbidden

- You're trying to access a resource that doesn't belong to you
- API keys are scoped to the user who created them

### Error: 404 Not Found

- The resource ID doesn't exist
- For checkouts, use the `uid` (Firestore document ID) returned by `list_checkouts`
- Note that `create_checkout` takes a different identifier: `productId`, the uid
  of the product being sold
- `Product <id> not found` from `create_checkout` means the product is missing or
  belongs to another seller — the API answers 403 for both, so they look alike

### Error: 429 Too Many Requests

- Rate limit exceeded (30 req/min or 1,000 req/hour)
- Read the `Retry-After` response header — it tells you exactly how many seconds to wait
- For bulk operations, space calls by at least 2 seconds to avoid hitting the limit in the first place
- See the [Rate Limits](#rate-limits) section for bulk operation guidelines

### Error: Invalid price format

- Use Reais as a number (`19.90`) or Brazilian format as a string (`"19,90"`)
- Don't mix formats

---

## Support

- 📧 Email: suporte@ggcheckout.com
- 📖 Docs: https://docs.ggcheckout.com
- 🐛 Issues: https://github.com/ggCheckout/ggcheckout-mcp/issues

## License

MIT © GG Checkout Team
