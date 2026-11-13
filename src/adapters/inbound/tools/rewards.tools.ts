import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RewardsService } from '../../../core/services/rewards.service.js';
import { createToolHandler } from '../tool-handler.js';
import { appMeta, withDrawnNote } from '../apps/apps.js';

export function registerRewardsTools(server: McpServer, service: RewardsService) {
  // `list_rewards` is gone with the route it called: there is no reward CATALOGUE endpoint, and the
  // milestones travel inside this response.
  server.registerTool('calculate_rewards', {
    description:
      'Reward progress and the milestone list, derived from paid sales. Returns { currentRevenue, '
      + 'currentRevenueCents, completedGoals, totalGoals, milestones, cachedAt?, fromCache? }. '
      + 'CAREFUL: currentRevenue and milestones are in REAIS already (currentRevenueCents is the same '
      + 'value in cents) — do not divide by 100 again. A cache miss is rate limited to 10/hour.',
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('calculate_rewards', async () => service.calculate())));

  server.registerTool('redeem_reward', {
    description:
      'Redeem the WhatsApp networking group once its milestone is reached (`whatsapp_group_5000`): answers '
      + '{ success, redeemType, redirectUrl, redeemCount, maxRedeems }, `redirectUrl` being the group invite. '
      + 'Only that reward is redeemed here. The bracelet and the plaques are shipped, so the dashboard redeems '
      + 'them with the seller\'s address (Recompensas); point the seller there.',
    inputSchema: { rewardId: z.literal('whatsapp_group_5000').describe('The WhatsApp group reward, the only one redeemed here') },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('redeem_reward', async ({ rewardId }) => service.redeem(rewardId))));
}
