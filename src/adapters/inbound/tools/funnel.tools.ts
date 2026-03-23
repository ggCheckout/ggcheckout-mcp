import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FunnelService } from '../../../core/services/funnel.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerFunnelTools(server: McpServer, service: FunnelService) {
  server.tool(
    'list_funnels',
    'List all funnels for the authenticated user',
    createToolHandler('list_funnels', async () => {
      const funnels = await service.list();
      return { funnels };
    }),
  );

  server.registerTool(
    'get_funnel',
    {
      description: 'Get full details of a funnel (steps, flow, design, settings, scoring)',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID'),
      },
    },
    createToolHandler('get_funnel', async ({ funnelId }) => {
      const funnel = await service.getById(funnelId);
      return { funnel };
    }),
  );

  server.registerTool(
    'create_funnel',
    {
      description: 'Create a new funnel with a title and optional slug',
      inputSchema: {
        title: z.string().min(1).max(50).describe('Funnel title (1-50 chars)'),
        slug: z.string().max(100).optional().describe('URL slug (lowercase, numbers, hyphens). Auto-generated if omitted.'),
      },
    },
    createToolHandler('create_funnel', async (args) => {
      const funnel = await service.create(args);
      return { success: true, funnel };
    }),
  );

  server.registerTool(
    'update_funnel',
    {
      description: 'Update a funnel. Only provide fields you want to change.',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID'),
        title: z.string().min(1).max(50).optional().describe('Funnel title'),
        slug: z.string().max(100).optional().describe('URL slug'),
        published: z.boolean().optional().describe('Publish or unpublish the funnel'),
        steps: z.array(z.object({}).passthrough()).optional().describe('Funnel steps array'),
        flow: z.object({}).passthrough().optional().describe('Flow configuration with edges'),
        design: z.object({}).passthrough().optional().describe('Design configuration'),
        settings: z.object({}).passthrough().optional().describe('Settings (SEO, pixels, scripts, webhook)'),
        scoring: z.object({}).passthrough().optional().describe('Scoring configuration (enabled, ranges)'),
      },
    },
    createToolHandler('update_funnel', async ({ funnelId, ...input }) => {
      const funnel = await service.update(funnelId, input);
      return { success: true, funnel };
    }),
  );

  server.registerTool(
    'delete_funnel',
    {
      description: 'Delete a funnel (soft delete)',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID'),
      },
    },
    createToolHandler('delete_funnel', async ({ funnelId }) => {
      await service.delete(funnelId);
      return { success: true, message: `Funnel ${funnelId} deleted` };
    }),
  );

  server.registerTool(
    'duplicate_funnel',
    {
      description: 'Duplicate an existing funnel (creates unpublished copy)',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID to duplicate'),
      },
    },
    createToolHandler('duplicate_funnel', async ({ funnelId }) => {
      const funnel = await service.duplicate(funnelId);
      return { success: true, funnel };
    }),
  );

  server.registerTool(
    'list_funnel_leads',
    {
      description: 'List leads captured by a funnel with pagination and status filter',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID'),
        status: z
          .enum(['visitor', 'lead', 'qualified', 'completed'])
          .optional()
          .describe('Filter by lead status'),
        limit: z.number().min(1).max(200).optional().describe('Items per page (default: 50, max: 200)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    createToolHandler('list_funnel_leads', async ({ funnelId, ...options }) => {
      return service.listLeads(funnelId, options);
    }),
  );

  server.registerTool(
    'get_funnel_lead_analytics',
    {
      description: 'Get funnel analytics: per-step visitors, exits, drop-off rate, and overall conversion',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID'),
      },
    },
    createToolHandler('get_funnel_lead_analytics', async ({ funnelId }) => {
      return service.getLeadAnalytics(funnelId);
    }),
  );

  server.registerTool(
    'get_funnel_lead_stats',
    {
      description: 'Get funnel lead statistics: visitors, leads, qualified, completed, interaction rate',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID'),
      },
    },
    createToolHandler('get_funnel_lead_stats', async ({ funnelId }) => {
      const stats = await service.getLeadStats(funnelId);
      return { stats };
    }),
  );
}
