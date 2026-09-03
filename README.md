# GG Checkout MCP Server

> Complete Model Context Protocol server for managing the GG Checkout platform via AI agents — 142 tools across 18 domains.

## Overview

The GG Checkout MCP server enables AI agents (Claude Code, Cursor, Claude Desktop) to manage the entire GG Checkout platform through natural language: products, checkouts, payments, members area, funnels, WhatsApp, billing, and more.

## Prerequisites

- Node.js >= 18.0.0
- A GG Checkout account with an active API Key

## Installation

### NPX (Recommended)

```bash
npx ggcheckout-mcp
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

> **Upgrading?** The snippet below is unpinned: `npx -y ggcheckout-mcp` picks up
> **every** new version on the next start — minor releases included, not just
> majors. 0.3.0 carries two breaking changes: `create_checkout` takes
> `productId` instead of `id`, and checkout reads (`list_checkouts`,
> `get_checkout`, `update_checkout`) return that pointer as `productId` instead
> of `id`. Read [CHANGELOG.md](./CHANGELOG.md) first, and pin
> `ggcheckout-mcp@0.2.4` if this is not the moment.

```json
{
  "mcpServers": {
    "ggcheckout": {
      "command": "npx",
      "args": ["-y", "ggcheckout-mcp"],
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

---

## Available Tools (142)

### Products (16 tools)

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

Update an existing product. Only provide fields you want to change.

**Parameters:** `productId` + any fields from create_product (all optional)

**Example prompt:** "Update product abc123 price to R$79.90"

#### `delete_product`

**Example prompt:** "Delete product abc123"

#### `upload_deliverable`

Upload a deliverable file to a product.

**Parameters:** `productId`, `fileUrl`, `fileName`, `fileType` (optional)

**Example prompt:** "Upload the ebook at https://files.example.com/ebook.pdf to product abc123"

#### `list_upsells` / `create_upsell` / `delete_upsell` / `reorder_upsells`

Manage upsells for a product.

**Example prompts:**
- "Show me the upsells for product abc123"
- "Create an upsell for product abc123 offering product xyz789 at R$29.90"
- "Reorder the upsells for product abc123"

#### `list_downsells` / `create_downsell` / `delete_downsell` / `reorder_downsells`

Manage downsells for a product.

**Example prompt:** "Add a downsell to product abc123 with a 50% discount headline"

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

Auto-merges with current data — only provide fields you want to change. The API
resets any field missing from the body rather than merging, so the whole document
is re-sent on your behalf; edits made outside the MCP between the read and the
write are the one thing this cannot preserve.

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
- "Create a webhook for payment.paid events at https://myapp.com/webhook"
- "Update webhook abc123 to also listen for payment.refunded"
- "Delete webhook abc123"
- "Send a test payment.paid event to webhook abc123"
- "Test my webhook abc123 with a refunded event overriding the payment ID to pay_xyz"

#### Webhook Event Payloads

All events share the same top-level shape. Key fields:

| Field | Type | Notes |
|---|---|---|
| `event` | string | Event type (see below) |
| `payment.id` | string | Payment identifier |
| `payment.status` | string | `pending`, `paid`, `refunded`, `expired`, `chargeback` |
| `payment.method` | string | `pix`, `pix.paid`, `card`, `card.paid` |
| `payment.amount` | number | Amount in **cents** (e.g. `9900` = R$99,00) |
| `payment.customer.name` | string | Buyer name |
| `payment.customer.email` | string | Buyer email |
| `payment.customer.document` | string | CPF |
| `payment.customer.phone` | string | Phone (E.164, e.g. `5511999999999`) |
| `payment.createdAt` | string | ISO 8601 |
| `payment.paidAt` | string \| undefined | Present on `payment.paid`, `payment.refunded`, `payment.chargeback` |
| `payment.refundedAt` | string \| undefined | Present on `payment.refunded` |
| `payment.expiredAt` | string \| undefined | Present on `payment.expired` |
| `product.id` | string | Product identifier |
| `product.title` | string | Product name |

**Supported events:**

```json
{ "event": "payment.created",    "payment": { "status": "pending",    "method": "pix" }, ... }
{ "event": "payment.paid",       "payment": { "status": "paid",       "method": "pix.paid", "paidAt": "..." }, ... }
{ "event": "payment.refunded",   "payment": { "status": "refunded",   "method": "pix.paid", "paidAt": "...", "refundedAt": "..." }, ... }
{ "event": "payment.expired",    "payment": { "status": "expired",    "method": "pix", "expiredAt": "..." }, ... }
{ "event": "payment.chargeback", "payment": { "status": "chargeback", "method": "card.paid", "paidAt": "..." }, ... }
```

**Signature verification** (when a `secret` is set):

```
X-Webhook-Signature: sha256=<HMAC-SHA256(secret, raw_body)>
X-GGCheckout-Event: payment.paid
```

```ts
import { createHmac } from 'crypto';
const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
const isValid = sig === incomingHeader.replace('sha256=', '');
```

---

### Store (9 tools)

**Example prompts:**
- "Show me my store configuration"
- "List all products in my store"
- "Get product details for product abc123 in store xyz"
- "Show me the categories in my store"
- "List customer reviews for my store with rating stats"
- "Validate coupon code SAVE20 for an order of R$100"

---

### Funnels / Quiz (9 tools)

**Example prompts:**
- "List all my funnels"
- "Show me the details of funnel abc123"
- "Create a new funnel called 'Lead Capture'"
- "Duplicate funnel abc123"
- "Show me the leads from funnel abc123 that completed all steps"
- "What's the conversion rate for funnel abc123?"
- "Show me the drop-off analytics for each step in funnel abc123"

---

### Members Area (21 tools)

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

---

### Discounts / Coupons (6 tools)

**Example prompts:**
- "Show me all my discounts"
- "Create a 15% discount coupon called SAVE15 for all products"
- "Create a buy-2-get-1 discount for product abc123"
- "Deactivate discount abc123"
- "Validate coupon SAVE15 for an order with 2 items totaling R$200"

---

### WhatsApp (15 tools)

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

### Billing (10 tools)

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

### Gateway Tokens (3 tools)

**Example prompts:**
- "List my payment gateway tokens"
- "Add a Stripe token"
- "Remove token abc123"

Supports 26+ gateways: pushinpay, mercadopago, stripe, efibank, amplopay, infinitepay, abacatepay, and more.

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

### Rewards / Goals (3 tools)

**Example prompts:**
- "What's my progress on sales milestones?"
- "Recalculate my reward progress"
- "Redeem the 10K bracelet reward"

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
git clone https://github.com/gui-drumond/ggcheckout-mcp.git
cd ggcheckout-mcp
npm install
```

### .env

```bash
GGCHECKOUT_API_KEY=ggck_live_your_key_here
GGCHECKOUT_API_URL=http://localhost:3000  # optional, defaults to https://ggcheckout.app
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

- 📧 Email: support@ggcheckout.com
- 📖 Docs: https://docs.ggcheckout.com
- 🐛 Issues: https://github.com/gui-drumond/ggcheckout-mcp/issues

## License

MIT © GG Checkout Team
