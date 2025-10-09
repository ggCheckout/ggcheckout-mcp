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

### 1. `list_products`

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

### 2. `get_product`

Get details of a specific product.

**Parameters:**
- `productId` (string): Product ID

**Example prompt:** "Get details of product abc123"

### 3. `create_product`

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

### 4. `update_product`

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

### 5. `delete_product`

Delete a product by ID.

**Parameters:**
- `productId` (string): Product ID

**Example prompt:** "Delete product abc123"

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
