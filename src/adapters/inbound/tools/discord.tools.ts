import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DiscordService } from '../../../core/services/discord.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerDiscordTools(server: McpServer, service: DiscordService) {
  server.tool('list_discord_connections', 'List all Discord server connections',
    createToolHandler('list_discord_connections', async () => {
      const connections = await service.listConnections();
      return { connections };
    }));

  server.registerTool('create_discord_connection', {
    description: 'Connect a Discord server (requires prior OAuth flow)',
    inputSchema: {
      guildId: z.string().describe('Discord server ID'),
      guildName: z.string().max(200).describe('Server name'),
      guildIcon: z.string().url().nullable().describe('Server icon URL'),
      discordUserId: z.string().describe('Discord user ID'),
      discordUsername: z.string().max(200).describe('Discord username'),
      discordAvatar: z.string().url().nullable().describe('User avatar URL'),
    },
  }, createToolHandler('create_discord_connection', async (args) => {
    const connection = await service.createConnection(args);
    return { success: true, connection };
  }));

  server.registerTool('update_discord_connection', {
    description: 'Update Discord connection settings (sales channel, roles, language)',
    inputSchema: {
      connectionId: z.string().describe('Connection ID'),
      settings: z.object({
        salesChannelId: z.string().nullable().optional(),
        salesChannelName: z.string().nullable().optional(),
        categoryId: z.string().nullable().optional(),
        logChannelId: z.string().nullable().optional(),
        rolesOnPurchase: z.array(z.string()).max(100).nullable().optional(),
        rolesOnPurchaseNames: z.array(z.string()).max(100).nullable().optional(),
        language: z.enum(['pt', 'en', 'es']).nullable().optional(),
      }).describe('Settings to update'),
    },
  }, createToolHandler('update_discord_connection', async ({ connectionId, settings }) => {
    await service.updateConnection(connectionId, settings);
    return { success: true, message: 'Connection updated' };
  }));

  server.registerTool('delete_discord_connection', {
    description: 'Disconnect a Discord server',
    inputSchema: { connectionId: z.string().describe('Connection ID') },
  }, createToolHandler('delete_discord_connection', async ({ connectionId }) => {
    await service.deleteConnection(connectionId);
    return { success: true, message: 'Server disconnected' };
  }));

  server.registerTool('get_guild_channels', {
    description: 'List text channels and categories in a Discord server',
    inputSchema: { guildId: z.string().describe('Discord server ID') },
  }, createToolHandler('get_guild_channels', async ({ guildId }) => service.getGuildChannels(guildId)));

  server.registerTool('get_guild_roles', {
    description: 'List roles in a Discord server',
    inputSchema: { guildId: z.string().describe('Discord server ID') },
  }, createToolHandler('get_guild_roles', async ({ guildId }) => {
    const roles = await service.getGuildRoles(guildId);
    return { roles };
  }));

  server.registerTool('create_private_channel', {
    description: 'Create a private sales notification channel in a Discord server',
    inputSchema: { guildId: z.string().describe('Discord server ID') },
  }, createToolHandler('create_private_channel', async ({ guildId }) => {
    const channel = await service.createPrivateChannel(guildId);
    return { success: true, channel };
  }));
}
