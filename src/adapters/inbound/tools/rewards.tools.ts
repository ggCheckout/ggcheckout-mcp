import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RewardsService } from '../../../core/services/rewards.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerRewardsTools(server: McpServer, service: RewardsService) {
  // `list_rewards` is gone with the route it called: there is no reward CATALOGUE endpoint, and the
  // milestones travel inside this response.
  server.tool(
    'calculate_rewards',
    'Reward progress and the milestone list, derived from paid sales. Returns { currentRevenue, '
      + 'currentRevenueCents, completedGoals, totalGoals, milestones, cachedAt?, fromCache? }. '
      + 'CAREFUL: currentRevenue and milestones are in REAIS already (currentRevenueCents is the same '
      + 'value in cents) — do not divide by 100 again. A cache miss is rate limited to 10/hour.',
    createToolHandler('calculate_rewards', async () => service.calculate()),
  );

  server.registerTool('redeem_reward', {
    description: 'Redeem a reward (e.g., bracelet, plaque, WhatsApp group access)',
    inputSchema: { rewardId: z.string().describe('Reward ID (e.g., "whatsapp_group_5000", "bracelet_10000", "plaque_50000")') },
  }, createToolHandler('redeem_reward', async ({ rewardId }) => service.redeem(rewardId)));
}
