import { readFileSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * MCP Apps (SEP-1865, spec 2026-01-26): a tool whose `_meta.ui.resourceUri` points to a `ui://`
 * resource is drawn by the host as that HTML, fed with the tool's result. Hosts without MCP Apps
 * ignore the `_meta` and keep reading the text content, so the tools answer exactly as before.
 */
export const APP_MIME_TYPE = 'text/html;profile=mcp-app';

export const SALES_DASHBOARD_URI = 'ui://ggcheckout/sales-dashboard.html';
export const PIX_CHARGE_URI = 'ui://ggcheckout/pix-charge.html';

/** The tool `_meta` that tells an MCP Apps host which view draws its result. */
export function appMeta(resourceUri: string) {
  return { ui: { resourceUri } };
}

const VIEWS_DIR = new URL('./views/', import.meta.url);
const INCLUDE = /<!-- include:([\w.\- ]+) -->/g;

/**
 * A view is one self-contained HTML document: the host loads it in a sandboxed iframe with no
 * network (the default CSP), so the shared CSS and scripts are inlined where the page says
 * `<!-- include:a.css b.js -->`. The scripts become ONE module, in the listed order, so they share
 * a scope without imports; the model files keep their `export`s for the unit tests.
 */
export function buildView(page: string): string {
  const read = (file: string) => readFileSync(new URL(file, VIEWS_DIR), 'utf-8');
  return read(page).replace(INCLUDE, (_, list: string) => {
    const files = list.trim().split(/\s+/);
    const styles = files.filter((f) => f.endsWith('.css')).map(read).join('\n');
    const scripts = files.filter((f) => f.endsWith('.js')).map(read).join('\n');
    return [
      styles && `<style>\n${styles}</style>`,
      scripts && `<script type="module">\n${scripts}</script>`,
    ].filter(Boolean).join('\n');
  });
}

const VIEWS = [
  {
    name: 'sales_dashboard',
    uri: SALES_DASHBOARD_URI,
    page: 'sales-dashboard.html',
    description: 'Sales panel: revenue over time, approval per method, top products and states',
  },
  {
    name: 'pix_charge',
    uri: PIX_CHARGE_URI,
    page: 'pix-charge.html',
    description: 'PIX QR code with copy-and-paste, expiry countdown and live payment status',
  },
] as const;

export function registerAppViews(server: McpServer) {
  for (const view of VIEWS) {
    let html: string | undefined;
    server.registerResource(view.name, view.uri, { mimeType: APP_MIME_TYPE, description: view.description }, async () => {
      html ??= buildView(view.page);
      return {
        contents: [{
          uri: view.uri,
          mimeType: APP_MIME_TYPE,
          text: html,
          // No csp: the data arrives through the host, so the restrictive default (no network) is
          // all a view needs. The copy button asks for the clipboard and falls back without it.
          _meta: { ui: { prefersBorder: true, permissions: { clipboardWrite: {} } } },
        }],
      };
    });
  }
}
