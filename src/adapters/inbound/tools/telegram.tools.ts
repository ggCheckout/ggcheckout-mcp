import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TelegramService } from '../../../core/services/telegram.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerTelegramTools(server: McpServer, service: TelegramService) {
  // =====================
  //  BOTS
  // =====================

  server.tool('list_telegram_bots', 'List all Telegram bots',
    createToolHandler('list_telegram_bots', async () => {
      const bots = await service.listBots();
      return { bots };
    }),
  );

  server.registerTool('get_telegram_bot', {
    description: 'Get details of a Telegram bot',
    inputSchema: { botId: z.string().describe('Bot ID') },
  }, createToolHandler('get_telegram_bot', async ({ botId }) => {
    return service.getBot(botId);
  }));

  server.registerTool('create_telegram_bot', {
    description: 'Create a new Telegram bot. Requires a valid Telegram bot token from @BotFather.',
    inputSchema: {
      name: z.string().min(1).max(100).describe('Bot display name'),
      token: z.string().min(10).describe('Telegram bot token from @BotFather'),
    },
  }, createToolHandler('create_telegram_bot', async ({ name, token }) => {
    return service.createBot({ name, token });
  }));

  server.registerTool('update_telegram_bot', {
    description: 'Update a Telegram bot (name, token, status, or language)',
    inputSchema: {
      botId: z.string().describe('Bot ID'),
      name: z.string().min(1).max(100).optional().describe('New bot name'),
      token: z.string().min(10).optional().describe('New bot token'),
      status: z.enum(['active', 'paused']).optional().describe('Bot status'),
      language: z.enum(['pt', 'en', 'es']).optional().describe('Bot language'),
    },
  }, createToolHandler('update_telegram_bot', async ({ botId, name, token, status, language }) => {
    const input: Record<string, any> = {};
    if (name !== undefined) input.name = name;
    if (token !== undefined) input.token = token;
    if (status !== undefined) input.status = status;
    if (language !== undefined) input.settings = { language };
    return service.updateBot(botId, input);
  }));

  server.registerTool('delete_telegram_bot', {
    description: 'Delete a Telegram bot',
    inputSchema: { botId: z.string().describe('Bot ID') },
  }, createToolHandler('delete_telegram_bot', async ({ botId }) => {
    return service.deleteBot(botId);
  }));

  server.registerTool('validate_telegram_token', {
    description: 'Validate a Telegram bot token. Returns username and capabilities if valid.',
    inputSchema: {
      token: z.string().min(10).describe('Telegram bot token to validate'),
      botId: z.string().optional().describe('Bot ID (optional, for bot-specific validation)'),
    },
  }, createToolHandler('validate_telegram_token', async ({ token, botId }) => {
    return service.validateToken(token, botId);
  }));

  server.registerTool('deploy_telegram_flow', {
    description: 'Deploy a flow to a Telegram bot. Activates the bot and publishes the flow.',
    inputSchema: {
      botId: z.string().describe('Bot ID'),
      flowId: z.string().describe('Flow ID to deploy'),
    },
  }, createToolHandler('deploy_telegram_flow', async ({ botId, flowId }) => {
    return service.deployFlow(botId, flowId);
  }));

  server.registerTool('get_telegram_bot_groups', {
    description: 'List groups where the bot has been added',
    inputSchema: { botId: z.string().describe('Bot ID') },
  }, createToolHandler('get_telegram_bot_groups', async ({ botId }) => {
    const groups = await service.getBotGroups(botId);
    return { groups };
  }));

  // =====================
  //  FLOWS
  // =====================

  server.registerTool('list_telegram_flows', {
    description: 'List Telegram flows. Optionally filter by bot.',
    inputSchema: {
      botId: z.string().optional().describe('Filter by bot ID'),
    },
  }, createToolHandler('list_telegram_flows', async ({ botId }) => {
    const flows = await service.listFlows(botId);
    return { flows };
  }));

  server.registerTool('get_telegram_flow', {
    description: 'Get full details of a Telegram flow (nodes, edges, variables, basicConfig)',
    inputSchema: { flowId: z.string().describe('Flow ID') },
  }, createToolHandler('get_telegram_flow', async ({ flowId }) => {
    return service.getFlow(flowId);
  }));

  server.registerTool('create_telegram_flow', {
    description: 'Create a new Telegram flow. Mode can be "basic" (tab-based funnel) or "visual" (node editor).',
    inputSchema: {
      botId: z.string().describe('Bot ID this flow belongs to'),
      name: z.string().min(1).max(100).describe('Flow name'),
      mode: z.enum(['basic', 'visual']).optional().describe('Flow mode (default: visual)'),
      basicConfig: z.record(z.any()).optional().describe('Basic flow config (for mode=basic)'),
    },
  }, createToolHandler('create_telegram_flow', async ({ botId, name, mode, basicConfig }) => {
    return service.createFlow({ botId, name, mode, basicConfig });
  }));

  server.registerTool('update_telegram_flow', {
    description: 'Update a Telegram flow (name, mode, nodes, edges, variables, published, basicConfig)',
    inputSchema: {
      flowId: z.string().describe('Flow ID'),
      name: z.string().min(1).max(100).optional().describe('Flow name'),
      mode: z.enum(['basic', 'visual']).optional().describe('Flow mode'),
      nodes: z.array(z.object({
        id: z.string(),
        type: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.any()),
      })).optional().describe('Flow nodes'),
      edges: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().optional(),
        label: z.string().optional(),
      })).optional().describe('Flow edges'),
      variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['string', 'number', 'boolean']),
        defaultValue: z.string().optional(),
      })).optional().describe('Flow variables'),
      published: z.boolean().optional().describe('Publish state'),
      basicConfig: z.record(z.any()).optional().describe('Basic flow config'),
    },
  }, createToolHandler('update_telegram_flow', async ({ flowId, ...input }) => {
    return service.updateFlow(flowId, input);
  }));

  server.registerTool('delete_telegram_flow', {
    description: 'Delete a Telegram flow. If active on a bot, it will be deactivated.',
    inputSchema: { flowId: z.string().describe('Flow ID') },
  }, createToolHandler('delete_telegram_flow', async ({ flowId }) => {
    return service.deleteFlow(flowId);
  }));

  // =====================
  //  LEADS
  // =====================

  server.registerTool('list_telegram_leads', {
    description: 'List Telegram leads with optional filters',
    inputSchema: {
      botId: z.string().optional().describe('Filter by bot ID'),
      flowId: z.string().optional().describe('Filter by flow ID'),
      status: z.enum(['visitor', 'lead', 'qualified', 'customer']).optional().describe('Filter by status'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
    },
  }, createToolHandler('list_telegram_leads', async (query) => {
    return service.listLeads(query);
  }));

  // =====================
  //  MEDIA UPLOAD
  // =====================

  server.registerTool('telegram_media_upload', {
    description: 'Generate a presigned URL for uploading media (images, videos, documents, audio) for use in Telegram flows. Max 500MB.',
    inputSchema: {
      fileName: z.string().min(1).max(255).describe('File name'),
      fileType: z.string().describe('MIME type (e.g. image/jpeg, video/mp4, application/pdf, audio/mpeg)'),
      fileSize: z.number().int().positive().describe('File size in bytes (max 500MB)'),
    },
  }, createToolHandler('telegram_media_upload', async (input) => {
    return service.uploadMedia(input);
  }));
}
