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

```json
{
  "mcpServers": {
    "ggcheckout": {
      "command": "npx",
      "args": ["ggcheckout-mcp"],
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

## Available Tools (141)

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

> **Note:** Use the `uid` (Firestore document ID), not the custom `id` slug.

#### `create_checkout`

**Required:** `title`, `id` (slug), `price`, `paymentMethods`, `checkout` (config)

**Example prompt:** "Create a checkout page for my React Course priced at R$99.90"

#### `update_checkout`

Auto-merges with current data — only provide fields you want to change.

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

If you're rate limited, wait 1-2 minutes and try again.

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
GGCHECKOUT_API_URL=http://localhost:3000  # optional, defaults to https://www.ggcheckout.com
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
- For checkouts, use the `uid` (Firestore document ID), not the custom `id` slug

### Error: 429 Too Many Requests

- Rate limit exceeded (30 req/min or 1000 req/hour)
- Wait 1-2 minutes and try again

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
