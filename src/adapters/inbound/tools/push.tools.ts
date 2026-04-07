import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PushService } from '../../../core/services/push.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerPushTools(server: McpServer, service: PushService) {
  server.tool('list_push_devices', 'List registered push notification devices',
    createToolHandler('list_push_devices', async () => service.listDevices()));

  server.registerTool('register_push_token', {
    description: 'Register a push notification token for a device',
    inputSchema: {
      token: z.string().describe('FCM push token'),
      deviceId: z.string().optional().describe('Device identifier'),
    },
  }, createToolHandler('register_push_token', async ({ token, deviceId }) => service.registerToken(token, deviceId)));

  server.registerTool('remove_push_device', {
    description: 'Remove a push notification device',
    inputSchema: { deviceId: z.string().describe('Device ID to remove') },
  }, createToolHandler('remove_push_device', async ({ deviceId }) => {
    await service.removeDevice(deviceId);
    return { success: true, message: 'Device removed' };
  }));
}
