# n8n-nodes-ggcheckout

n8n community node for GG Checkout integration.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Credentials

The node uses the following credentials:

### GG Checkout API

- **API Key**: Your GG Checkout API key (starts with `ggck_live_`)
- **API URL**: GG Checkout API base URL (default: `https://www.ggcheckout.com`)

## Operations

### Product Operations

- **List Products**: Get all your products
- **Get Product**: Get details of a specific product
- **Create Product**: Create a new product
- **Update Product**: Update an existing product
- **Delete Product**: Delete a product

### Payment Operations

- **List Payments**: Get all payments for a business
- **Get Payment**: Get details of a specific payment
- **Get Paginated Payments**: Get paginated payments with filters

### Checkout Operations

- **List Checkouts**: Get all checkout pages
- **Get Checkout**: Get details of a specific checkout
- **Create Checkout**: Create a new checkout page
- **Update Checkout**: Update an existing checkout
- **Delete Checkout**: Delete a checkout

### Webhook Operations

- **List Webhooks**: Get all webhooks
- **Get Webhook**: Get details of a specific webhook
- **Create Webhook**: Create a new webhook
- **Update Webhook**: Update an existing webhook
- **Delete Webhook**: Delete a webhook

## License

MIT
