import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WhatsAppService } from '../../../core/services/whatsapp.service.js';
import { PAYMENT_EVENT_TYPES } from '../../../core/types/whatsapp.js';
import { createToolHandler } from '../tool-handler.js';

const IN_DASHBOARD = 'Creating or deleting it is refused to API keys by design (403): that happens in the dashboard.';

const sessionIds = z.array(z.string()).max(50)
  .describe('Sessions (ids from list_whatsapp_sessions) the template sends for. Empty leaves it unlinked: it never fires');
const templateFields = {
  attachedProducts: z.array(z.string()).max(100).optional().describe('Only for these product IDs; absent means every product of the sessions'),
  customFileUrl: z.string().url().optional().describe('Custom file URL (for text_with_file)'),
  customImageUrl: z.string().url().optional().describe('Custom image URL (for text_with_image)'),
  delayMinutes: z.number().min(0).max(525600).optional().describe('Delay in minutes before sending'),
  allowedHoursStart: z.number().int().min(0).max(23).optional().describe('Sending window start, Brasília hour (0-23)'),
  allowedHoursEnd: z.number().int().min(0).max(23).optional().describe('Sending window end, Brasília hour (0-23)'),
  sendToCustomer: z.boolean().optional().describe('Send to customer (default: true)'),
  sendToAdmin: z.boolean().optional().describe('Also send to admin'),
  adminPhone: z.string().max(20).optional().describe('Admin phone number'),
  paymentMethods: z.array(z.enum(['pix', 'credit_card'])).max(2).optional().describe('Only for these payment methods; absent or empty means all'),
};

/**
 * WhatsApp as the dashboard models it: chips are the connected numbers, and a session is a primary
 * chip with up to two fallbacks that sends for a set of products. Templates belong to sessions.
 */
export function registerWhatsAppTools(server: McpServer, service: WhatsAppService) {
  // --- Chips ---
  server.tool('list_whatsapp_numbers',
    `List the WhatsApp chips (connected numbers): status (pending, qr_code, authenticated, disconnected, banned, error), provider (waha = QR code, meta = official API), isActive and how many sessions use each. ${IN_DASHBOARD}`,
    createToolHandler('list_whatsapp_numbers', async () => ({ numbers: await service.listNumbers() })),
  );

  server.registerTool('get_whatsapp_number', {
    description: 'Get a WhatsApp chip with its live status and the sessions that use it (usedBy, with its role: primary or fallback)',
    inputSchema: { numberId: z.string().describe('Chip ID (from list_whatsapp_numbers)') },
  }, createToolHandler('get_whatsapp_number', async ({ numberId }) => ({ number: await service.getNumber(numberId) })));

  server.registerTool('update_whatsapp_number', {
    description: 'Turn a WhatsApp chip on or off. An inactive chip does not send for any session',
    inputSchema: {
      numberId: z.string().describe('Chip ID'),
      isActive: z.boolean().describe('true to send with it, false to pause it'),
    },
  }, createToolHandler('update_whatsapp_number', async ({ numberId, isActive }) => ({
    success: true, number: await service.setNumberActive(numberId, isActive),
  })));

  server.registerTool('get_pairing_code', {
    description:
      'Get a code to connect a QR code chip (provider waha) without scanning: on the phone, WhatsApp > Linked devices > '
      + 'Link a device > Link with phone number instead, then type the code. Then poll get_whatsapp_number until its '
      + 'status is authenticated. Fails for a Meta chip or one already connected',
    inputSchema: {
      numberId: z.string().describe('Chip ID (from list_whatsapp_numbers)'),
      phoneNumber: z.string().max(20).describe('The phone number of the WhatsApp to connect, with country and area code (e.g., "5511999999999")'),
    },
  }, createToolHandler('get_pairing_code', async ({ numberId, phoneNumber }) => service.getPairingCode(numberId, phoneNumber)));

  server.registerTool('restart_whatsapp_number', {
    description: 'Restart a QR code chip (provider waha) that is stuck or disconnected: it goes back to pending and needs connecting again (get_pairing_code)',
    inputSchema: { numberId: z.string().describe('Chip ID') },
  }, createToolHandler('restart_whatsapp_number', async ({ numberId }) => service.restartNumber(numberId)));

  // --- Sessions ---
  server.tool('list_whatsapp_sessions',
    `List the WhatsApp sessions: each sends for its assignedProducts with its primary chip (primaryNumberId) and up to two fallbacks in order (fallbackNumberIds). ${IN_DASHBOARD}`,
    createToolHandler('list_whatsapp_sessions', async () => ({ sessions: await service.listSessions() })),
  );

  server.registerTool('get_whatsapp_session', {
    description: 'Get a WhatsApp session: its chips (primary and fallbacks), products and whether it is active',
    inputSchema: { sessionId: z.string().describe('Session ID (from list_whatsapp_sessions)') },
  }, createToolHandler('get_whatsapp_session', async ({ sessionId }) => ({ session: await service.getSession(sessionId) })));

  server.registerTool('update_whatsapp_session', {
    description:
      'Rename, pause or resume a WhatsApp session, or set its chips. primaryNumberId and fallbackNumberIds go together: '
      + 'send both to reorder or swap roles. A paused session sends with none of its chips',
    inputSchema: {
      sessionId: z.string().describe('Session ID'),
      name: z.string().min(1).max(60).optional().describe('Session name'),
      isActive: z.boolean().optional().describe('false pauses the session'),
      primaryNumberId: z.string().optional().describe('Chip that sends first'),
      fallbackNumberIds: z.array(z.string()).max(2).optional().describe('Up to two chips that take over, in order'),
    },
  }, createToolHandler('update_whatsapp_session', async ({ sessionId, ...update }) => ({
    success: true, session: await service.updateSession(sessionId, update),
  })));

  server.registerTool('add_whatsapp_session_number', {
    description: 'Add a chip to a WhatsApp session, as its last fallback (at most two fallbacks)',
    inputSchema: {
      sessionId: z.string().describe('Session ID'),
      numberId: z.string().describe('Chip ID'),
    },
  }, createToolHandler('add_whatsapp_session_number', async ({ sessionId, numberId }) => ({
    success: true, session: await service.addSessionNumber(sessionId, numberId),
  })));

  server.registerTool('remove_whatsapp_session_number', {
    description: 'Remove a chip from a WhatsApp session. Removing the primary promotes the first fallback; the last chip cannot be removed',
    inputSchema: {
      sessionId: z.string().describe('Session ID'),
      numberId: z.string().describe('Chip ID'),
    },
  }, createToolHandler('remove_whatsapp_session_number', async ({ sessionId, numberId }) => ({
    success: true, session: await service.removeSessionNumber(sessionId, numberId),
  })));

  server.registerTool('set_whatsapp_session_products', {
    description: 'Set the products a WhatsApp session sends for. Replaces the whole list: send every product to keep',
    inputSchema: {
      sessionId: z.string().describe('Session ID'),
      productIds: z.array(z.string()).max(500).describe('Product IDs; an empty list leaves the session without products'),
    },
  }, createToolHandler('set_whatsapp_session_products', async ({ sessionId, productIds }) => ({
    success: true, session: await service.setSessionProducts(sessionId, productIds),
  })));

  // --- Templates ---
  server.registerTool('list_whatsapp_templates', {
    description: 'List WhatsApp message templates, optionally only those of one session',
    inputSchema: {
      sessionId: z.string().optional().describe('Session ID (from list_whatsapp_sessions)'),
    },
  }, createToolHandler('list_whatsapp_templates', async ({ sessionId }) => {
    const templates = await service.listTemplates(sessionId);
    return { templates };
  }));

  server.registerTool('create_whatsapp_template', {
    description: 'Create a WhatsApp message template for a payment event, sent by the sessions it is linked to',
    inputSchema: {
      sessionIds,
      eventType: z.enum(PAYMENT_EVENT_TYPES).describe('Payment event that triggers this template'),
      messageText: z.string().max(10000).describe('Message text (supports variables like {{nome}}, {{produto}}, {{valor}}, {{checkout_url}})'),
      sendType: z.enum(['text_only', 'text_with_file', 'text_with_image']).describe('Message format'),
      ...templateFields,
    },
  }, createToolHandler('create_whatsapp_template', async (args) => {
    const template = await service.createTemplate(args);
    return { success: true, template };
  }));

  server.registerTool('update_whatsapp_template', {
    description: 'Update a WhatsApp message template. Only provide fields to change; sessionIds replaces the linked sessions',
    inputSchema: {
      templateId: z.string().describe('Template ID'),
      sessionIds: sessionIds.optional(),
      messageText: z.string().max(10000).optional().describe('Message text'),
      sendType: z.enum(['text_only', 'text_with_file', 'text_with_image']).optional().describe('Message format'),
      ...templateFields,
    },
  }, createToolHandler('update_whatsapp_template', async ({ templateId, ...input }) => {
    const template = await service.updateTemplate(templateId, input);
    return { success: true, template };
  }));

  server.registerTool('toggle_whatsapp_template', {
    description: 'Enable or disable a WhatsApp message template',
    inputSchema: { templateId: z.string().describe('Template ID') },
  }, createToolHandler('toggle_whatsapp_template', async ({ templateId }) => {
    const template = await service.toggleTemplate(templateId);
    return { success: true, template };
  }));

  server.registerTool('delete_whatsapp_template', {
    description: 'Delete a WhatsApp message template',
    inputSchema: { templateId: z.string().describe('Template ID') },
  }, createToolHandler('delete_whatsapp_template', async ({ templateId }) => {
    await service.deleteTemplate(templateId);
    return { success: true, message: `Template ${templateId} deleted` };
  }));

  // --- Deliveries ---
  server.registerTool('get_delivery_status', {
    description: 'Get WhatsApp delivery status for a payment (sent, delivered, read, failed)',
    inputSchema: { paymentId: z.string().describe('Payment ID') },
  }, createToolHandler('get_delivery_status', async ({ paymentId }) => {
    return service.getDeliveryStatus(paymentId);
  }));

  server.registerTool('resend_delivery', {
    description: 'Resend WhatsApp delivery for a payment (rate limited: 50/hour per user)',
    inputSchema: { paymentId: z.string().describe('Payment ID') },
  }, createToolHandler('resend_delivery', async ({ paymentId }) => {
    return service.resendDelivery(paymentId);
  }));
}
