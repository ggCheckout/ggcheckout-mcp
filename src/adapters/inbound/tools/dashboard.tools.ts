import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DashboardService } from '../../../core/services/dashboard.service.js';
import { createToolHandler } from '../tool-handler.js';
import { appMeta, SALES_DASHBOARD_URI } from '../apps/apps.js';

export function registerDashboardTools(server: McpServer, service: DashboardService) {
  server.registerTool('get_dashboard_stats', {
    description:
      'Get dashboard statistics for the period and the one before it: sales, revenue and average ticket '
      + '(both in CENTS), and pending, failed, expired, cancelled and refunded counts. The answer to '
      + '"how much did I sell today?" and comparisons with the previous period.',
    inputSchema: {
      range: z.enum(['today', 'yesterday', 'week', 'month', 'year', 'all']).optional().describe('Time range (default: week)'),
    },
    _meta: appMeta(SALES_DASHBOARD_URI),
  }, createToolHandler('get_dashboard_stats', async ({ range }) => service.getStats(range)));

  server.registerTool('get_dashboard_charts', {
    description:
      'Get dashboard chart data; amounts in CENTS. Pass `focus` for the part the user asked about, so the '
      + 'answer (and the inline view) carries only that: `revenue` (revenue and sales over time, average '
      + 'ticket, conversion), `approval` (approval per payment method and gateway), `products` (top '
      + 'products and order bumps), `states` (sales per state) or `refunds` (refunds, chargebacks, MED). '
      + 'Leave it out only when the user asks for the whole dashboard.',
    inputSchema: {
      range: z.enum(['today', 'yesterday', 'week', 'month', 'year', 'all']).optional().describe('Time range (default: week)'),
      tz: z.string().optional().describe('Timezone (default: America/Sao_Paulo)'),
      focus: z.enum(['revenue', 'approval', 'products', 'states', 'refunds']).optional()
        .describe('The part of the dashboard the question is about (default: everything)'),
    },
    _meta: appMeta(SALES_DASHBOARD_URI),
  }, createToolHandler('get_dashboard_charts', async ({ range, tz, focus }) => service.getCharts(range, tz, focus)));

  server.tool('invalidate_dashboard_cache', 'Force refresh of dashboard cache',
    createToolHandler('invalidate_dashboard_cache', async () => {
      await service.invalidateCache();
      return { success: true, message: 'Dashboard cache invalidated' };
    }));
}
