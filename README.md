# GG Checkout MCP Server

> Complete Model Context Protocol server for managing the GG Checkout platform via AI agents — 141 tools across 18 domains.

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

| Tool | Description |
|------|-------------|
| `list_products` | List all products |
| `get_product` | Get product details |
| `create_product` | Create product (requires title, description, price, discount, url) |
| `update_product` | Update product (partial fields) |
| `delete_product` | Delete product |
| `upload_deliverable` | Upload deliverable file via URL |
| `delete_deliverable` | Remove deliverable |
| `list_upsells` | List product upsells |
| `create_upsell` | Create upsell (requires upsellProductId, upsellId) |
| `delete_upsell` | Remove upsell |
| `reorder_upsells` | Reorder upsells |
| `list_downsells` | List downsells |
| `create_downsell` | Create downsell (requires downsellProductId, downsellId) |
| `delete_downsell` | Remove downsell |
| `reorder_downsells` | Reorder downsells |
| `manage_tags` | Manage product tags `{ name, color }[]` |

### Checkouts (6 tools)

| Tool | Description |
|------|-------------|
| `list_checkouts` | List seller checkouts |
| `get_checkout` | Get checkout details |
| `create_checkout` | Create checkout page |
| `update_checkout` | Update checkout (auto-merges with current data) |
| `delete_checkout` | Delete checkout |
| `manage_checkout_tags` | Manage tags `{ name, color }[]` (max 5, hex color) |

### Payments (7 tools)

| Tool | Description |
|------|-------------|
| `get_my_business_id` | Get authenticated seller's business ID |
| `list_payments` | List payments |
| `get_payments_paginated` | Paginated payments with filters |
| `get_payment` | Get payment details |
| `get_payment_fulfillment` | Fulfillment status (physical orders) |
| `update_payment_fulfillment` | Update fulfillment (shipped, tracking, etc.) |
| `check_payment_status` | Check status at payment gateway |

### Webhooks (5 tools)

| Tool | Description |
|------|-------------|
| `list_webhooks` | List webhooks |
| `get_webhook` | Get webhook details |
| `create_webhook` | Create webhook |
| `update_webhook` | Update webhook |
| `delete_webhook` | Delete webhook |

### Store (9 tools)

| Tool | Description |
|------|-------------|
| `get_store_config` | Store configuration (theme, payment methods) |
| `get_store_public` | Full public store data (store + categories + products) |
| `list_store_products` | Catalog with pagination, search, sorting |
| `get_store_product` | Product details (variants, stock) |
| `list_categories` | Store categories |
| `list_custom_fields` | Custom checkout fields |
| `get_store_order` | Order details |
| `list_feedbacks` | Reviews with stats |
| `validate_coupon` | Validate coupon code |

### Funnels / Quiz (9 tools)

| Tool | Description |
|------|-------------|
| `list_funnels` | List funnels |
| `get_funnel` | Full details (steps, flow, design, settings) |
| `create_funnel` | Create funnel |
| `update_funnel` | Update funnel |
| `delete_funnel` | Delete funnel (soft delete) |
| `duplicate_funnel` | Duplicate funnel |
| `list_funnel_leads` | Leads with pagination and status filter |
| `get_funnel_lead_analytics` | Analytics (per-step drop-off, conversion) |
| `get_funnel_lead_stats` | Stats (visitors, leads, qualified, completed) |

### Members Area (21 tools)

| Tool | Description |
|------|-------------|
| `list_members_areas` | List members areas |
| `get_members_area` | Area details |
| `create_members_area` | Create area linked to product |
| `update_members_area` | Update customization |
| `duplicate_members_area` | Duplicate entire area |
| `list_modules` | List modules |
| `create_module` | Create module |
| `reorder_modules` | Reorder modules |
| `list_sections` | List sections |
| `create_section` | Create section |
| `reorder_sections` | Reorder sections |
| `list_lessons` | List lessons |
| `create_lesson` | Create lesson (video, text, pdf, quiz, file) |
| `reorder_lessons` | Reorder lessons |
| `list_classes` | List classes |
| `create_class` | Create class |
| `list_students` | List students |
| `get_student` | Student details |
| `add_student` | Add student (creates account + welcome email) |
| `update_student` | Update student |
| `import_students` | Bulk import students (max 100) |

### Discounts / Coupons (6 tools)

| Tool | Description |
|------|-------------|
| `list_discounts` | List discounts |
| `get_discount` | Discount details |
| `create_discount` | Create discount (percentage, fixed, free_shipping, buy_x_get_y) |
| `update_discount` | Update discount |
| `delete_discount` | Delete discount |
| `validate_discount_code` | Validate coupon against order |

### WhatsApp (15 tools)

| Tool | Description |
|------|-------------|
| `list_whatsapp_sessions` | List sessions |
| `get_whatsapp_session` | Session status |
| `create_whatsapp_session` | Create session |
| `delete_whatsapp_session` | Delete session |
| `get_pairing_code` | Get pairing code (no QR needed) |
| `list_whatsapp_templates` | List message templates |
| `create_whatsapp_template` | Create template by event type |
| `update_whatsapp_template` | Update template |
| `toggle_whatsapp_template` | Enable/disable template |
| `delete_whatsapp_template` | Delete template |
| `get_delivery_status` | Delivery status by payment |
| `resend_delivery` | Resend delivery |
| `send_whatsapp_message` | Send direct message |

### Billing (10 tools)

| Tool | Description |
|------|-------------|
| `get_billing_balance` | Balance, credit, usage %, next charge |
| `get_billing_status` | Status (active, pending_card, grace_period, blocked) |
| `get_billing_history` | Charge history |
| `list_invoices` | Invoices |
| `get_invoice` | Invoice details |
| `pay_invoice` | Pay invoice (pix, card, credits) |
| `list_credits` | Credits |
| `add_credit` | Add credit via PIX |
| `get_card_status` | Saved card status |
| `remove_card` | Remove card |

### Shipping / MelhorEnvio (7 tools)

| Tool | Description |
|------|-------------|
| `calculate_shipping` | Calculate shipping (postal code + dimensions) |
| `verify_shipping` | Verify shipping status |
| `create_shipping_cart` | Create MelhorEnvio cart |
| `cancel_shipping_cart` | Cancel cart |
| `checkout_shipping` | Pay for label |
| `generate_shipping_label` | Generate label |
| `print_shipping_label` | Get print URL |

### Gateway Tokens (3 tools)

| Tool | Description |
|------|-------------|
| `list_tokens` | List gateway tokens |
| `insert_token` | Add gateway token |
| `delete_token` | Remove gateway token |

Supports 26+ gateways: pushinpay, mercadopago, stripe, efibank, amplopay, infinitepay, abacatepay, and more.

### Discord (7 tools)

| Tool | Description |
|------|-------------|
| `list_discord_connections` | List connections |
| `create_discord_connection` | Connect server |
| `update_discord_connection` | Update settings (channels, roles, language) |
| `delete_discord_connection` | Disconnect server |
| `get_guild_channels` | List server channels |
| `get_guild_roles` | List server roles |
| `create_private_channel` | Create private sales channel |

### Dashboard (3 tools)

| Tool | Description |
|------|-------------|
| `get_dashboard_stats` | Stats (sales, revenue, average ticket) |
| `get_dashboard_charts` | Chart data (time series) |
| `invalidate_dashboard_cache` | Force cache refresh |

### Custom Domains (5 tools)

| Tool | Description |
|------|-------------|
| `list_custom_domains` | List domains |
| `add_custom_domain` | Add domain (max 5) |
| `get_custom_domain` | Details + DNS status |
| `delete_custom_domain` | Remove domain |
| `verify_custom_domain` | Verify DNS |

### Rewards / Goals (3 tools)

| Tool | Description |
|------|-------------|
| `list_rewards` | Current progress |
| `calculate_rewards` | Recalculate progress |
| `redeem_reward` | Redeem reward |

### Profile / Auth (6 tools)

| Tool | Description |
|------|-------------|
| `get_profile` | Profile data |
| `update_profile` | Update profile |
| `list_support_emails` | List support emails |
| `add_support_email` | Add email (sends verification) |
| `delete_support_email` | Remove email |
| `get_kyc_status` | KYC verification status |

### Push Notifications (3 tools)

| Tool | Description |
|------|-------------|
| `list_push_devices` | List devices |
| `register_push_token` | Register FCM token |
| `remove_push_device` | Remove device |

---

## Price Formats

Prices are accepted in two formats:

- **Reais (recommended):** `19.90` = R$19.90 → stored as `1990` cents
- **Brazilian format:** `"19,90"` or `"1.990,00"`

All prices are stored internally in cents.

---

## Security

The MCP server automatically sanitizes all data before sending to the AI agent:

**Credentials stripped:** webhook secrets, gateway tokens, WhatsApp QR codes, card tokens, internal worker URLs.

**PII masked (LGPD):** CPF (`***.***.*89-01`), phone (`*******7766`), email (`j**n@example.com`), customer IP removed, address reduced to city/state only.

### Best Practices

- Never share your API key publicly
- Always use environment variables
- Revoke compromised keys immediately
- Generate new keys periodically
- Don't hardcode keys in your code
- Don't commit keys to version control

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Per hour | 1,000 requests |
| Per minute | 30 requests |

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

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid or expired API key | Check your key in the dashboard |
| 403 Forbidden | Resource belongs to another seller | API keys are scoped per user |
| 404 Not Found | ID doesn't exist | Verify the ID |
| 429 Too Many Requests | Rate limit exceeded | Wait 1-2 minutes |
| Invalid price format | Wrong price format | Use `19.90` or `"19,90"` |

---

## Support

- Issues: https://github.com/gui-drumond/ggcheckout-mcp/issues

## License

MIT © GG Checkout Team
