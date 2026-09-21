import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FunnelService } from '../../../core/services/funnel.service.js';
import type { UpdateFunnelInput } from '../../../core/types/funnel.js';
import { createToolHandler } from '../tool-handler.js';

const slugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'slug may only contain lowercase letters, numbers and hyphens');

const componentTypeSchema = z.enum([
  'alert', 'arguments', 'audio', 'button', 'card', 'carousel', 'cartesian',
  'compare', 'confetti', 'countdown', 'coupon', 'divider', 'email', 'faq',
  'form', 'gate', 'guarantee', 'headline', 'hero', 'iframe', 'image', 'input',
  'level', 'list', 'loading', 'logo', 'marquee', 'menu', 'pix', 'price', 'progress',
  'question', 'result', 'reviews', 'social_proof', 'stats', 'terms', 'text', 'video', 'whatsapp',
]);

const loadingScreenSchema = z.object({
  enabled: z.boolean(),
  duration: z.number().min(500).max(5000).describe('Total duration in ms'),
  color: z.string().describe('Bar color (hex)'),
  targetPercent: z.number().min(10).max(95).describe('Where the bar pauses before completing'),
  showText: z.boolean(),
  text: z.string(),
  mediaType: z.enum(['none', 'emoji', 'image']),
  mediaValue: z.string().describe('Emoji or image URL'),
}).partial().passthrough();

// Steps are sent back whole, so every field the editor stores must survive the round trip:
// unknown keys pass through instead of being stripped.
const stepSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number(),
  components: z.array(z.object({
    id: z.string(),
    type: componentTypeSchema.describe('Component type'),
    order: z.number(),
    props: z.record(z.string(), z.unknown()).describe('Component properties'),
  }).passthrough()),
  position: z.object({ x: z.number(), y: z.number() }),
  loadingScreen: loadingScreenSchema.optional().describe('Per-step loading screen override'),
  showLogo: z.boolean().optional().describe('Omit to follow design.header'),
  showProgress: z.boolean().optional().describe('Omit to follow design.general.showProgress'),
  allowBack: z.boolean().optional().describe('Omit to allow going back'),
  stickyButton: z.boolean().optional().describe('Sticky CTA bar at the bottom'),
  stickyButtonLabel: z.string().optional().describe('Microcopy above the sticky button'),
}).passthrough();

export function registerFunnelTools(server: McpServer, service: FunnelService) {
  server.tool(
    'list_funnels',
    'List all funnels (quizzes) for the authenticated user',
    createToolHandler('list_funnels', async () => {
      const funnels = await service.list();
      return { funnels };
    }),
  );

  server.registerTool(
    'get_funnel',
    {
      description: 'Get full details of a funnel/quiz (steps, flow, design, settings, scoring)',
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
      description:
        'Create a new funnel (the dashboard calls it a quiz) with a title and optional slug. It starts unpublished with one empty step; build it with update_funnel.',
      inputSchema: {
        title: z.string().min(1).max(50).describe('Funnel title (1-50 chars)'),
        slug: slugSchema.optional().describe('URL slug (lowercase, numbers, hyphens). Auto-generated if omitted.'),
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
      description:
        'Update a funnel/quiz. Top-level fields you omit are kept. `design` and `settings` are merged into the stored ones, '
        + 'so send only the keys you change. `steps`, `flow.edges` and `scoring` REPLACE the stored value: '
        + 'call get_funnel, edit the full array and send it back. A quiz is questions (`question` components with options '
        + 'and optional scores), `result` components, `scoring.ranges` and conditional `flow.edges`.',
      inputSchema: {
        funnelId: z.string().describe('Funnel ID'),
        title: z.string().min(1).max(50).optional().describe('Funnel title'),
        slug: slugSchema.optional().describe('URL slug'),
        published: z.boolean().optional().describe('Publish or unpublish the funnel'),
        steps: z.array(stepSchema).max(100).optional().describe('ALL steps, in full (replaces the stored steps)'),
        flow: z.object({
          edges: z.array(z.object({
            id: z.string(),
            source: z.string().describe('Step id the edge leaves from'),
            target: z.string().describe('Step id the edge goes to'),
            sourceHandle: z.string().optional(),
            label: z.string().optional(),
            condition: z.object({
              questionId: z.string(),
              operator: z.enum(['equals', 'contains', 'gt', 'lt', 'score_range']),
              value: z.string(),
            }).optional(),
            isFallback: z.boolean().optional().describe('Taken when no condition matches'),
          })).max(500),
        }).optional().describe('ALL flow edges (replaces the stored flow)'),
        design: z.object({
          general: z.object({
            maxWidth: z.number(), spacing: z.number(), borderRadius: z.number(), showProgress: z.boolean(),
          }).partial().optional(),
          header: z.object({
            logoUrl: z.string(), bgColor: z.string(), showHeader: z.boolean(),
          }).partial().optional(),
          colors: z.object({
            primary: z.string(), secondary: z.string(), background: z.string(), text: z.string(),
            input: z.record(z.string(), z.string()),
            button: z.record(z.string(), z.record(z.string(), z.string())),
            hover: z.record(z.string(), z.string()),
            checkbox: z.record(z.string(), z.string()),
          }).partial().optional(),
          typography: z.object({
            headingFont: z.string(), bodyFont: z.string(), headingWeight: z.number(), bodyWeight: z.number(),
          }).partial().optional(),
          animation: z.object({
            type: z.enum(['none', 'fade', 'slide', 'scale']),
            speed: z.number(),
            direction: z.enum(['up', 'down', 'left', 'right']),
          }).partial().optional(),
          loadingScreen: loadingScreenSchema.optional().describe('Loading screen between steps'),
        }).optional().describe('Design changes, merged into the stored design'),
        settings: z.object({
          customDomainId: z.string().nullable().optional().describe('Id from list_custom_domains; null to remove'),
          seo: z.object({
            title: z.string(), description: z.string(), ogImage: z.string(), favicon: z.string(),
          }).partial().optional(),
          pixelTokenIds: z.object({
            facebook_ads: z.string(), tiktok_ads: z.string(), google_ads: z.string(),
          }).partial().optional().describe('Pixel token ids from list_tokens (type facebook_ads / tiktok_ads / google_ads), one per platform'),
          scripts: z.object({
            head: z.string().max(10000),
            body: z.string().max(10000),
            footer: z.string().max(10000),
          }).partial().optional(),
          webhookIds: z.array(z.string()).max(50).optional().describe('Ids from list_webhooks that receive quiz.completed (replaces the list)'),
          clarity: z.object({ projectId: z.string() }).partial().optional().describe('Microsoft Clarity project id for this funnel'),
          postPurchaseUrl: z.string().url().optional().describe('Where the buyer goes after a confirmed payment'),
        }).optional().describe('Settings changes, merged into the stored settings'),
        scoring: z.object({
          enabled: z.boolean(),
          ranges: z.array(z.object({
            id: z.string(), label: z.string(), minScore: z.number(), maxScore: z.number(),
          })).max(50),
        }).optional().describe('Scoring configuration (replaces the stored one)'),
      },
    },
    createToolHandler('update_funnel', async ({ funnelId, ...input }) => {
      const funnel = await service.update(funnelId, input as UpdateFunnelInput);
      return { success: true, funnel };
    }),
  );

  server.registerTool(
    'list_funnel_checkouts',
    {
      description:
        'List the checkouts and payment gateways a funnel `pix` component can use (checkout uid, price, order bumps; gateway id, type, name). Use the ids in the component props.',
      inputSchema: {
        method: z.enum(['pix', 'credit_card']).optional().describe('Payment method the gateways must support (default: pix)'),
      },
    },
    createToolHandler('list_funnel_checkouts', async ({ method }) => {
      return service.listCheckouts(method);
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
