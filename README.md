# GG Checkout MCP Server

> Model Context Protocol server for managing GG Checkout products via AI agents

## Overview

The GG Checkout MCP server enables AI agents (like Claude Desktop) to interact with your GG Checkout products directly. Create, read, update, and delete products using natural language through your favorite AI assistant.

## Prerequisites

- Node.js >= 18.0.0
- A GG Checkout account
- An active API Key from GG Checkout

## Installation

### Option 1: NPX (Recommended)

No installation required! Just configure your MCP client with:

```bash
npx @ggcheckout/mcp
```

### Option 2: Global Install

```bash
npm install -g @ggcheckout/mcp
```

## Getting Your API Key

1. Visit [https://www.ggcheckout.com/](https://www.ggcheckout.com/)
2. Log in to your GG Checkout dashboard
3. Navigate to **Settings** → **API Key**
4. Click **Generate API Key**
5. **Important:** Copy and save your API key immediately - it won't be shown again!

Your API key will look like: `ggck_live_abc123...`

## Configuration

### For Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ggcheckout": {
      "command": "npx",
      "args": ["@ggcheckout/mcp"],
      "env": {
        "GGCHECKOUT_API_KEY": "ggck_live_your_api_key_here"
      }
    }
  }
}
```

> **Note:** The API URL is hardcoded to `https://www.ggcheckout.com/` for production use.

### For Other MCP Clients

Set the API key environment variable:

```bash
export GGCHECKOUT_API_KEY="ggck_live_your_api_key_here"
```

## Available Tools

### Product Tools

#### 1. `list_products`

List all your products/deliveries.

**Example prompt:** "Show me all my products"

**Response:**
```json
{
  "products": [
    {
      "uid": "abc123",
      "title": "React Course",
      "url": "https://example.com/react-course",
      "description": "Complete React course",
      "discount": "30%",
      "price": 9900
    }
  ]
}
```

#### 2. `get_product`

Get details of a specific product.

**Parameters:**
- `productId` (string): Product ID

**Example prompt:** "Get details of product abc123"

#### 3. `create_product`

Create a new product/delivery.

**Parameters:**
- `title` (string): Product title
- `url` (string): Product URL
- `imageUrl` (string, optional): Product image URL
- `description` (string): Product description
- `discount` (string): Discount info (e.g., "30%")
- `price` (number|string): Price in cents (1990) or Brazilian format ("19,90")

**Example prompts:**
- "Create a product called 'React Course' priced at R$99.00"
- "Add a new product: title 'Node.js Guide', price 4990 cents, url https://example.com"

**Example:**
```json
{
  "title": "React Course",
  "url": "https://example.com/react-course",
  "imageUrl": "https://example.com/cover.png",
  "description": "Lifetime access",
  "discount": "30%",
  "price": 9900
}
```

#### 4. `update_product`

Update an existing product. Only provide fields you want to change.

**Parameters:**
- `productId` (string): Product ID
- `title` (string, optional): New title
- `url` (string, optional): New URL
- `imageUrl` (string, optional): New image URL
- `description` (string, optional): New description
- `discount` (string, optional): New discount
- `price` (number|string, optional): New price

**Example prompt:** "Update product abc123 price to R$79.90"

#### 5. `delete_product`

Delete a product by ID.

**Parameters:**
- `productId` (string): Product ID

**Example prompt:** "Delete product abc123"

### User Tools

#### 6. `get_my_business_id`

Get the business ID of the authenticated user. This tool automatically retrieves your businessId from the API key authentication, making it easy to use other tools without manually specifying the businessId.

**Parameters:** None

**Example prompt:** "What is my business ID?"

**Response:**
```json
{
  "businessId": "CKdAlYZpHhSKrFnA6ljGewe16Go1"
}
```

**Pro Tip:** Once you have your businessId, you can use it in natural language queries like:
- "Show me all payments for business CKdAlYZpHhSKrFnA6ljGewe16Go1"
- Or simply: "Get my business ID, then show me all payments"

### Payment Tools

#### 7. `list_payments`

List all payments for a specific business.

**Parameters:**
- `businessId` (string): Business ID to list payments for

**Example prompt:** "Show me all payments for business xyz789"

**Response:**
```json
{
  "payments": [
    {
      "id": "txn_123456",
      "businessId": "xyz789",
      "email": "customer@example.com",
      "value": 99.90,
      "productId": "prod_abc",
      "titleOffer": "React Course",
      "status": "paid",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 8. `get_payments_paginated`

Get paginated payments with advanced filtering options.

**Important:** Status filtering is done **client-side** after fetching data from the API. This follows the same pattern as the frontend application to avoid requiring Firestore composite indexes.

**Parameters:**
- `businessId` (string): Business ID
- `pageSize` (number, optional): Items per page (default: 10)
- `dateFrom` (string, optional): Filter from date (ISO format)
- `dateTo` (string, optional): Filter until date (ISO format)
- `lastCreatedAt` (string, optional): Pagination cursor
- `status` (string, optional): Filter by status ("pending", "paid", "error", "all") - **filtered client-side**
- `searchTerm` (string, optional): Search by payment ID, email, phone, or title
- `countOnly` (boolean, optional): Return only total count

**Example prompts:**
- "Get the first 20 payments for business xyz789"
- "Show me all paid payments from last month for business xyz789"
- "Search for payments with email john@example.com in business xyz789"
- "How many pending payments does business xyz789 have?"

**Response:**
```json
{
  "payments": [...],
  "total": 150,
  "lastCreatedAt": "2024-01-15T10:30:00Z"
}
```

#### 9. `get_payment`

Get details of a specific payment by ID.

**Note:** This tool fetches all payments from the business and filters client-side to find the specific payment. This approach avoids Firestore composite index requirements that would be needed for direct search queries.

**Parameters:**
- `businessId` (string): Business ID
- `paymentId` (string): Payment ID (transaction ID)

**Example prompt:** "Get payment cmgjucuk201ztcgsya2w9bo53 from my business"

**Response:**
```json
{
  "payment": {
    "id": "txn_123456",
    "businessId": "xyz789",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+5511999999999",
    "cpf": "12345678900",
    "value": 99.90,
    "productId": "prod_abc",
    "titleOffer": "React Course",
    "status": "paid",
    "createdAt": "2024-01-15T10:30:00Z",
    "finalValueInCents": 9990,
    "couponsCodesApplied": ["SAVE20"]
  }
}
```

### Checkout Tools

#### 10. `list_checkouts`

List all checkout pages for the authenticated user.

**Parameters:** None (automatically uses authenticated user)

**Example prompt:** "Show me all my checkouts" or "List my checkout pages"

**Response:**
```json
{
  "checkouts": [
    {
      "uid": "checkout123",
      "id": "my-product-checkout",
      "title": "React Course Checkout",
      "price": 99.90,
      "published": true,
      "url": "https://checkout.ggcheckout.com/my-product-checkout"
    }
  ]
}
```

#### 11. `get_checkout`

Get details of a specific checkout page.

**Parameters:**
- `checkoutId` (string): Checkout document ID (uid) - **Note: Use the `uid` returned from `create_checkout`, not the custom `id` field**

**Example prompt:** "Get checkout details for checkout123"

**Important:** 
- `uid` = Firestore document ID (use this for get/update/delete operations)
- `id` = Custom checkout slug/identifier (user-friendly name)

**Response:**
```json
{
  "checkout": {
    "uid": "checkout123",
    "id": "my-product-checkout",
    "title": "React Course Checkout",
    "price": 99.90,
    "published": true,
    "paymentMethods": {...},
    "checkout": {...},
    "orderBumps": []
  }
}
```

#### 12. `create_checkout`

Create a new checkout page.

**Required Parameters:**
- `title` (string): Checkout page title
- `id` (string): Unique checkout slug/identifier (user-friendly name, e.g., "my-product-checkout")
- `price` (number): Price in Brazilian Reais (e.g., 99.90)
- `paymentMethods` (object): Payment methods configuration
- `checkout` (object): Checkout page configuration

**Optional Parameters:**
- `url` (string): Checkout URL
- `bannerUrl` (string): Banner image URL
- `image` (string): Product image URL
- `sellerName` (string): Seller name
- `orderBumps` (array): Order bumps (upsells)
- `fields` (object): Custom form fields (`{haveName: boolean, havePhone: boolean, haveCpf: boolean}`)
- `socialCard` (array): Social card configuration
- `published` (boolean): Published status (default: true)
- `metricToken` (string): Metrics token
- `emailProviderToken` (string): Email provider token

**Example prompt:** "Create a checkout page for my React Course priced at R$99.90"

**Response:**
```json
{
  "success": true,
  "message": "Produto criado com sucesso.",
  "checkout": {
    "uid": "AbC123XyZ456",
    "id": "my-product-checkout",
    "title": "React Course Checkout",
    "price": 99.90,
    "fields": {
      "haveName": false,
      "havePhone": false,
      "haveCpf": false
    }
  }
}
```

**Important:** Save the `uid` from the response - you'll need it for get/update/delete operations!

#### 13. `update_checkout`

Update an existing checkout page. Only provide fields you want to change.

**Parameters:**
- `checkoutId` (string): Checkout document ID (uid) - **Use the `uid` from create_checkout response**
- All other parameters are optional (same as create_checkout)

**Example prompt:** "Update checkout AbC123XyZ456 price to R$79.90"

**Response:**
```json
{
  "success": true,
  "checkout": {
    "uid": "checkout123",
    "price": 79.90
  }
}
```

#### 14. `delete_checkout`

Delete a checkout page by ID.

**Parameters:**
- `checkoutId` (string): Checkout document ID (uid) - **Use the `uid` from create_checkout response**

**Example prompt:** "Delete checkout AbC123XyZ456"

**Response:**
```json
{
  "success": true,
  "message": "Checkout checkout123 deleted successfully"
}
```

## Price Formats

The server accepts prices in two formats:

1. **Cents (recommended):** `1990` = R$19.90
2. **Brazilian format:** `"19,90"` or `"1.990,00"`

Internally, all prices are stored in cents.

## Troubleshooting

### Error: 401 Unauthorized

- Check that your API key is correct
- Ensure the key starts with `ggck_live_`
- Verify the key hasn't been revoked in your dashboard

### Error: 403 Forbidden

- You're trying to access a resource that doesn't belong to you
- API keys are scoped to the user who created them

### Error: 404 Not Found

- The product ID doesn't exist
- Check the product ID is correct

### Error: Invalid price format

- Use cents (number) or Brazilian format (string)
- Examples: `1990` or `"19,90"`

### Rate Limiting

If you're making too many requests, you may be rate limited. Wait a few moments and try again.

## Local Development

For local development and testing against your localhost backend:

1. Clone the repository
2. Copy `.env.local` to `.env`
3. Edit `src/index.ts` and uncomment the localhost line:

```typescript
// Change this:
const API_URL = 'https://www.ggcheckout.com';

// To this:
const API_URL = process.env.GGCHECKOUT_API_URL || 'http://localhost:3000';
```

4. Set your `.env` file:
```bash
GGCHECKOUT_API_KEY=ggck_live_your_api_key_here
GGCHECKOUT_API_URL=http://localhost:3000
```

5. Build and run:
```bash
npm install
npm run build
node dist/index.js
```

## Security Best Practices

🔒 **Never share your API key publicly**

✅ Always use environment variables  
✅ Revoke compromised keys immediately  
✅ Generate new keys periodically  
❌ Don't hardcode keys in your code  
❌ Don't commit keys to version control

## Support

- 📧 Email: support@ggcheckout.com
- 📖 Docs: https://docs.ggcheckout.com
- 🐛 Issues: https://github.com/ggcheckout/mcp/issues

## License

MIT © GG Checkout Team
