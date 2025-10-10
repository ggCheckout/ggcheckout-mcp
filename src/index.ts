#!/usr/bin/env node

import dotenv from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './api/client.js';
import { registerProductTools } from './tools/products.js';
import { registerPaymentTools } from './tools/payments.js';
import { registerCheckoutTools } from './tools/checkouts.js';
import * as logger from './utils/logger.js';

dotenv.config();

const API_KEY = process.env.GGCHECKOUT_API_KEY;
const API_URL = process.env.GGCHECKOUT_API_URL || 'https://www.ggcheckout.com';

if (!API_KEY) {
  console.error('[MCP] Error: Missing required environment variable');
  console.error('[MCP] Please set GGCHECKOUT_API_KEY');
  console.error('[MCP] Example:');
  console.error('[MCP]   GGCHECKOUT_API_KEY=ggck_live_your_key_here');
  console.error('[MCP] Get your API key at: https://www.ggcheckout.com/');
  process.exit(1);
}

if (!API_KEY.startsWith('ggck_live_')) {
  console.error('[MCP] Error: Invalid API key format');
  console.error('[MCP] API key must start with "ggck_live_"');
  process.exit(1);
}

logger.info('STARTUP', 'Initializing GG Checkout MCP Server');
logger.info('STARTUP', `API URL: ${API_URL}`);

const apiClient = new ApiClient(API_URL, API_KEY);

const server = new McpServer({
  name: 'ggcheckout-mcp',
  version: '0.1.0',
});

registerProductTools(server, apiClient);
registerPaymentTools(server, apiClient);
registerCheckoutTools(server, apiClient);

logger.info('STARTUP', 'Registered 14 tools: list_products, get_product, create_product, update_product, delete_product, get_my_business_id, list_payments, get_payments_paginated, get_payment, list_checkouts, get_checkout, create_checkout, update_checkout, delete_checkout');

const transport = new StdioServerTransport();
await server.connect(transport);

logger.info('STARTUP', 'Server started successfully');

process.on('SIGINT', async () => {
  logger.info('SHUTDOWN', 'Received SIGINT, shutting down gracefully');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SHUTDOWN', 'Received SIGTERM, shutting down gracefully');
  await server.close();
  process.exit(0);
});
