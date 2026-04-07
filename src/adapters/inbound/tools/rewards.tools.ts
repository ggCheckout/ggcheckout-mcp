import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RewardsService } from '../../../core/services/rewards.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerRewardsTools(server: McpServer, service: RewardsService) {
  server.tool('list_rewards', 'Get reward milestones and current progress',
    createToolHandler('list_rewards', async () => service.getProgress()));

  server.tool('calculate_rewards', 'Calculate/refresh reward progress from actual sales data',
    createToolHandler('calculate_rewards', async () => service.calculate()));

  server.registerTool('redeem_reward', {
    description: 'Redeem a reward (e.g., bracelet, plaque, WhatsApp group access)',
    inputSchema: { rewardId: z.string().describe('Reward ID (e.g., "whatsapp_group_5000", "bracelet_10000", "plaque_50000")') },
  }, createToolHandler('redeem_reward', async ({ rewardId }) => service.redeem(rewardId)));
}
