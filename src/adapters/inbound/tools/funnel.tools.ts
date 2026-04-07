import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FunnelService } from '../../../core/services/funnel.service.js';
import type { UpdateFunnelInput } from '../../../core/types/funnel.js';
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
        steps: z.array(z.object({
          id: z.string(),
          title: z.string(),
          order: z.number(),
          components: z.array(z.object({
            id: z.string(),
            type: z.enum([
              'alert', 'arguments', 'audio', 'button', 'card', 'carousel', 'cartesian',
              'compare', 'confetti', 'countdown', 'coupon', 'divider', 'email', 'faq',
              'form', 'gate', 'guarantee', 'headline', 'hero', 'iframe', 'image', 'input',
              'list', 'loading', 'logo', 'marquee', 'menu', 'pix', 'price', 'progress',
              'question', 'result', 'reviews', 'stats', 'terms', 'text', 'video', 'whatsapp',
            ]).describe('Component type'),
            order: z.number(),
            props: z.record(z.string(), z.unknown()).describe('Component properties'),
          })),
          position: z.object({ x: z.number(), y: z.number() }),
        })).max(100).optional().describe('Funnel steps array'),
        flow: z.object({
          edges: z.array(z.object({
            id: z.string(),
            source: z.string(),
            target: z.string(),
            sourceHandle: z.string().optional(),
            label: z.string().optional(),
            condition: z.object({
              questionId: z.string(),
              operator: z.enum(['equals', 'contains', 'gt', 'lt', 'score_range']),
              value: z.string(),
            }).optional(),
            isFallback: z.boolean().optional(),
          })).max(500),
        }).optional().describe('Flow configuration with edges'),
        design: z.object({
          general: z.object({
            maxWidth: z.number(), spacing: z.number(), borderRadius: z.number(), showProgress: z.boolean().optional(),
          }).optional(),
          header: z.object({
            logoUrl: z.string(), bgColor: z.string(), showHeader: z.boolean(),
          }).optional(),
          colors: z.object({
            primary: z.string(), secondary: z.string(), background: z.string(), text: z.string(),
            input: z.record(z.string(), z.string()).optional(),
            button: z.record(z.string(), z.record(z.string(), z.string())).optional(),
            hover: z.record(z.string(), z.string()).optional(),
            checkbox: z.record(z.string(), z.string()).optional(),
          }).optional(),
          typography: z.object({
            headingFont: z.string(), bodyFont: z.string(), headingWeight: z.number(), bodyWeight: z.number(),
          }).optional(),
          animation: z.object({
            type: z.enum(['none', 'fade', 'slide', 'scale']),
            speed: z.number(),
            direction: z.enum(['up', 'down', 'left', 'right']),
          }).optional(),
        }).optional().describe('Design configuration'),
        settings: z.object({
          customDomain: z.string().optional(),
          seo: z.object({
            title: z.string(), description: z.string(), ogImage: z.string(), favicon: z.string(),
          }).optional(),
          pixels: z.object({
            facebookId: z.string().optional(), tiktokId: z.string().optional(), googleId: z.string().optional(),
          }).optional(),
          scripts: z.object({
            head: z.string().max(10000).optional(),
            body: z.string().max(10000).optional(),
            footer: z.string().max(10000).optional(),
          }).optional(),
          webhookUrl: z.string().url().optional(),
        }).optional().describe('Settings (SEO, pixels, scripts, webhook)'),
        scoring: z.object({
          enabled: z.boolean(),
          ranges: z.array(z.object({
            id: z.string(), label: z.string(), minScore: z.number(), maxScore: z.number(),
          })).max(50),
        }).optional().describe('Scoring configuration (enabled, ranges)'),
      },
    },
    createToolHandler('update_funnel', async ({ funnelId, ...input }) => {
      const funnel = await service.update(funnelId, input as UpdateFunnelInput);
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
