#!/usr/bin/env node

import dotenv from 'dotenv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as logger from './shared/logger.js';

import { createServer, type CreatedServer } from './server.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// quiet: dotenv >= 17 prints to STDOUT, which is the MCP protocol channel over stdio; that line
// reaches the client as a malformed frame.
dotenv.config({ quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const API_KEY = process.env.GGCHECKOUT_API_KEY;
const API_URL = process.env.GGCHECKOUT_API_URL || 'https://ggcheckout.app';

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

let created: CreatedServer;
try {
  created = createServer({ apiKey: API_KEY, apiUrl: API_URL, version: pkg.version, env: process.env });
} catch (err: any) {
  console.error(`[MCP] Error: ${err.message}`);
  process.exit(1);
}
const { server, paymentsUrl } = created;
if (paymentsUrl) logger.info('STARTUP', `Payments API tools enabled (${paymentsUrl})`);

logger.info('STARTUP', 'All tools registered');

// Transport
const transport = new StdioServerTransport();
await server.connect(transport);

logger.info('STARTUP', 'Server started successfully');

async function shutdown(signal: string) {
  logger.info('SHUTDOWN', `Received ${signal}, shutting down gracefully`);
  const forceTimeout = setTimeout(() => {
    logger.error('SHUTDOWN', 'Graceful shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  try {
    await server.close();
    process.exit(0);
  } catch (err: any) {
    logger.error('SHUTDOWN', 'Error during shutdown', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
