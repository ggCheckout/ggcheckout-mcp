import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DashboardService } from '../../../core/services/dashboard.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerDashboardTools(server: McpServer, service: DashboardService) {
  server.registerTool('get_dashboard_stats', {
    description: 'Get dashboard statistics (sales, revenue, conversions, average ticket)',
    inputSchema: {
      range: z.enum(['today', 'yesterday', 'week', 'month', 'year', 'all']).optional().describe('Time range (default: week)'),
    },
  }, createToolHandler('get_dashboard_stats', async ({ range }) => service.getStats(range)));

  server.registerTool('get_dashboard_charts', {
    description: 'Get dashboard chart data (time series for sales/revenue)',
    inputSchema: {
      range: z.enum(['today', 'yesterday', 'week', 'month', 'year', 'all']).optional().describe('Time range (default: week)'),
      tz: z.string().optional().describe('Timezone (default: America/Sao_Paulo)'),
    },
  }, createToolHandler('get_dashboard_charts', async ({ range, tz }) => service.getCharts(range, tz)));

  server.tool('invalidate_dashboard_cache', 'Force refresh of dashboard cache',
    createToolHandler('invalidate_dashboard_cache', async () => {
      await service.invalidateCache();
      return { success: true, message: 'Dashboard cache invalidated' };
    }));
}
