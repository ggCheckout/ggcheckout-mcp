import { readFileSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as logger from '../../../shared/logger.js';
import type { ToolResult } from '../tool-handler.js';

/**
 * MCP Apps (SEP-1865, spec 2026-01-26): a tool whose `_meta.ui.resourceUri` points to a `ui://`
 * resource is drawn by the host as that HTML, fed with the tool's result. Hosts without MCP Apps
 * ignore the `_meta` and keep reading the text content, so the tools answer exactly as before.
 */
export const APP_MIME_TYPE = 'text/html;profile=mcp-app';

/** Every view lives in one app (ui/, built to dist/views/app.html); it picks the view by tool. */
export const APP_URI = 'ui://ggcheckout/app.html';

/** The tool `_meta` that tells an MCP Apps host to draw the result with the app. */
export function appMeta() {
  return { ui: { resourceUri: APP_URI } };
}

/**
 * The built app, read once. The same relative path resolves from src/ (tsx) and from dist/ (the
 * published package), because both sit four levels under the package root.
 */
const APP_FILE = new URL('../../../../dist/views/app.html', import.meta.url);
let appHtml: string | undefined;

export function loadAppHtml(): string {
  try {
    appHtml ??= readFileSync(APP_FILE, 'utf-8');
  } catch {
    throw new Error('dist/views/app.html is missing: build the views with `npm run build`');
  }
  return appHtml;
}

const UI_EXTENSION = 'io.modelcontextprotocol/ui';

/** Whether the connected client draws MCP Apps views, as it announced in `initialize`. */
export function clientDrawsViews(server: McpServer): boolean {
  const extensions = (server.server.getClientCapabilities() as { extensions?: Record<string, { mimeTypes?: string[] }> } | undefined)?.extensions;
  return Boolean(extensions?.[UI_EXTENSION]?.mimeTypes?.includes(APP_MIME_TYPE));
}

const DRAWN_NOTE =
  'The user sees this result drawn as an interactive card right above your reply. Answer in one or two '
  + 'sentences with the takeaway; do not restate these figures as a list or a table.';

/**
 * Only for a client that draws the view: a note before the data, so the model does not repeat as text
 * what the card already shows. A host may give the model `structuredContent` instead of the text, so
 * the note goes in both (as `_view`, distinct from the `_notice` of third-party data). A text-only
 * client gets the result unchanged.
 */
export function withDrawnNote<TArgs>(server: McpServer, handler: (args: TArgs) => Promise<ToolResult>) {
  return async (args: TArgs): Promise<ToolResult> => {
    const result = await handler(args);
    if (result.isError || !clientDrawsViews(server)) return result;
    return {
      ...result,
      content: [{ type: 'text', text: DRAWN_NOTE }, ...result.content],
      ...(result.structuredContent ? { structuredContent: { _view: DRAWN_NOTE, ...result.structuredContent } } : {}),
    };
  };
}

export function registerAppViews(server: McpServer) {
  server.server.oninitialized = () => {
    logger.info('STARTUP', `Client ${clientDrawsViews(server) ? 'draws' : 'does not draw'} MCP Apps views`);
  };
  server.registerResource('ggcheckout_app', APP_URI, {
    mimeType: APP_MIME_TYPE,
    description: 'GG Checkout views: sales panel, funnel leads, payments, billing wallet, invoices and credit statement, custom domains with their DNS, WhatsApp deliveries, gateways charge order and stability, rewards trail, post-purchase offers, members area tree, Telegram flow, WhatsApp chips, and PIX charges with live status',
  }, async () => ({
    contents: [{
      uri: APP_URI,
      mimeType: APP_MIME_TYPE,
      text: loadAppHtml(),
      // No csp: the data arrives through the host, so the restrictive default (no network) is all
      // the app needs. The copy button asks for the clipboard and falls back without it.
      _meta: { ui: { prefersBorder: true, permissions: { clipboardWrite: {} } } },
    }],
  }));
}
