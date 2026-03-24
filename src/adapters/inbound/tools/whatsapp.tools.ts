import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WhatsAppService } from '../../../core/services/whatsapp.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerWhatsAppTools(server: McpServer, service: WhatsAppService) {
  // --- Sessions ---
  server.tool('list_whatsapp_sessions', 'List all WhatsApp sessions',
    createToolHandler('list_whatsapp_sessions', async () => {
      const sessions = await service.listSessions();
      return { sessions };
    }),
  );

  server.registerTool('get_whatsapp_session', {
    description: 'Get detailed status of a WhatsApp session',
    inputSchema: { sessionId: z.string().describe('Session ID') },
  }, createToolHandler('get_whatsapp_session', async ({ sessionId }) => {
    const session = await service.getSession(sessionId);
    return { session };
  }));

  server.registerTool('create_whatsapp_session', {
    description: 'Create a new WhatsApp session',
    inputSchema: { sessionName: z.string().max(200).describe('Session name') },
  }, createToolHandler('create_whatsapp_session', async ({ sessionName }) => {
    const session = await service.createSession(sessionName);
    return { success: true, session };
  }));

  server.registerTool('delete_whatsapp_session', {
    description: 'Delete a WhatsApp session',
    inputSchema: { sessionId: z.string().describe('Session ID') },
  }, createToolHandler('delete_whatsapp_session', async ({ sessionId }) => {
    await service.deleteSession(sessionId);
    return { success: true, message: `Session ${sessionId} deleted` };
  }));

  server.registerTool('get_pairing_code', {
    description: 'Get a pairing code to connect WhatsApp without QR code scanning',
    inputSchema: {
      sessionId: z.string().describe('Session ID'),
      phoneNumber: z.string().max(20).describe('Phone number with country code (e.g., "5511999999999")'),
    },
  }, createToolHandler('get_pairing_code', async ({ sessionId, phoneNumber }) => {
    return service.getPairingCode(sessionId, phoneNumber);
  }));

  // --- Templates ---
  server.registerTool('list_whatsapp_templates', {
    description: 'List WhatsApp message templates, optionally filtered by session',
    inputSchema: {
      sessionId: z.string().optional().describe('Filter by session ID'),
    },
  }, createToolHandler('list_whatsapp_templates', async ({ sessionId }) => {
    const templates = await service.listTemplates(sessionId);
    return { templates };
  }));

  server.registerTool('create_whatsapp_template', {
    description: 'Create a WhatsApp message template for a specific event type',
    inputSchema: {
      sessionId: z.string().describe('Session ID'),
      eventType: z.enum(['paid', 'product_delivery', 'pending', 'expired', 'cancelled', 'refunded', 'failed', 'recovery_pix_unpaid', 'recovery_pix_expired']).describe('Payment event that triggers this template'),
      messageText: z.string().max(10000).describe('Message text (supports variables like {nome}, {produto}, {link})'),
      sendType: z.enum(['text_only', 'text_with_file', 'text_with_image']).describe('Message format'),
      attachedProducts: z.array(z.string()).max(100).optional().describe('Product IDs this template applies to'),
      customFileUrl: z.string().url().optional().describe('Custom file URL (for text_with_file)'),
      customImageUrl: z.string().url().optional().describe('Custom image URL (for text_with_image)'),
      delayMinutes: z.number().min(0).max(525600).optional().describe('Delay in minutes before sending'),
      sendToCustomer: z.boolean().optional().describe('Send to customer (default: true)'),
      sendToAdmin: z.boolean().optional().describe('Also send to admin'),
      adminPhone: z.string().max(20).optional().describe('Admin phone number'),
    },
  }, createToolHandler('create_whatsapp_template', async (args) => {
    const template = await service.createTemplate(args);
    return { success: true, template };
  }));

  server.registerTool('update_whatsapp_template', {
    description: 'Update a WhatsApp message template. Only provide fields to change.',
    inputSchema: {
      templateId: z.string().describe('Template ID'),
      messageText: z.string().max(10000).optional().describe('Message text'),
      sendType: z.enum(['text_only', 'text_with_file', 'text_with_image']).optional().describe('Message format'),
      attachedProducts: z.array(z.string()).max(100).optional().describe('Product IDs'),
      customFileUrl: z.string().url().optional().describe('Custom file URL'),
      customImageUrl: z.string().url().optional().describe('Custom image URL'),
      delayMinutes: z.number().min(0).max(525600).optional().describe('Delay in minutes'),
      sendToCustomer: z.boolean().optional().describe('Send to customer'),
      sendToAdmin: z.boolean().optional().describe('Send to admin'),
      adminPhone: z.string().max(20).optional().describe('Admin phone'),
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

  // --- Send ---
  server.registerTool('send_whatsapp_message', {
    description: 'Send a direct WhatsApp message via a session (text or file)',
    inputSchema: {
      sessionId: z.string().describe('Session ID to send from'),
      phone: z.string().max(20).describe('Recipient phone number with country code'),
      message: z.string().max(10000).describe('Message text'),
      type: z.enum(['text', 'file']).optional().describe('Message type (default: text)'),
      fileUrl: z.string().url().optional().describe('File URL (for file type)'),
      fileName: z.string().max(200).optional().describe('File name'),
      fileType: z.string().optional().describe('File MIME type'),
    },
  }, createToolHandler('send_whatsapp_message', async (args) => {
    return service.sendMessage(args);
  }));
}
