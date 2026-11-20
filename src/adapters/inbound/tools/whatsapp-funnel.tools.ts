import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WhatsAppFunnelService } from '../../../core/services/whatsapp-funnel.service.js';
import { FUNNEL_LIMITS, FUNNEL_TRIGGERS } from '../../../core/types/whatsapp-funnel.js';
import { createToolHandler } from '../tool-handler.js';
import { appMeta, withDrawnNote } from '../apps/apps.js';
import { cappedText, guid } from './whatsapp-schemas.js';

const L = FUNNEL_LIMITS;

const stepSchema = z.object({
  waitMinutes: z.number().int().min(L.minWaitMinutes).max(L.maxWaitMinutes)
    .describe(`Minutes to wait before this message, counted from the previous one (${L.minWaitMinutes} to ${L.maxWaitMinutes}, i.e. up to 2 days)`),
  text: cappedText(L.maxText).refine((text) => text.trim().length > 0, { message: 'Text must not be empty' })
    .describe(`Message text, up to ${L.maxText} characters. Supports variables like {{nome}}`),
  markSeen: z.boolean().describe('Mark the contact\'s chat as seen before sending'),
  showTyping: z.boolean().describe('Show "typing..." before sending'),
}).strict();

const layoutKey = z.string().regex(new RegExp(`^(?:start|end|(?:wait|message)-[1-${L.maxSteps}])$`));
const layoutSchema = z.record(layoutKey, z.object({
  x: z.number().int().min(-L.layoutBound).max(L.layoutBound),
  y: z.number().int().min(-L.layoutBound).max(L.layoutBound),
}).strict()).refine((layout) => Object.keys(layout).length <= L.layoutEntries, { message: `At most ${L.layoutEntries} blocks` });

const funnelFields = {
  name: cappedText(L.maxName, { trim: true }).refine((name) => name.trim().length > 0, { message: 'Name must not be empty' })
    .describe(`Funnel name, up to ${L.maxName} characters`),
  trigger: z.enum(FUNNEL_TRIGGERS)
    .describe('What starts it: abandoned_cart, pix_unpaid, pix_expired, card_refused, card_cancelled, or manual (only runs when the seller starts it in an inbox conversation). One enabled funnel per automatic trigger'),
  sessionGroupId: guid().describe('WhatsApp operation (session id from list_whatsapp_sessions) that sends. Required for a manual funnel; an automatic funnel sends by the operation of each product and ignores it'),
  stopOnReply: z.boolean().describe('Stop when the contact replies (a purchase always stops it)'),
  sendWindow: z.object({
    start: z.number().int().min(0).max(23),
    end: z.number().int().min(1).max(24),
  }).strict().refine((w) => w.start < w.end, { message: 'start must be before end' }).nullable()
    .describe('Sending window in Brasília hours [start, end), or null for the whole day'),
  signature: cappedText(L.maxSignature, { trim: true }).describe(`Signature the seller sets, up to ${L.maxSignature} characters; empty for none`),
  coupon: cappedText(L.maxCoupon, { trim: true }).describe(`Coupon code the messages may mention, up to ${L.maxCoupon} characters; empty for none`),
  useEmoji: z.boolean().describe('Whether the messages may use emoji'),
  steps: z.array(stepSchema).min(1).max(L.maxSteps).describe(`The messages, 1 to ${L.maxSteps}, in the order they go out`),
  layout: layoutSchema.nullable().describe('Position of the blocks on the dashboard board (drawing only; send order is the steps). Keys: start, end, wait-1..5, message-1..5'),
};

const funnelId = guid().describe('Funnel ID (from list_whatsapp_funnels)');

const importContact = z.object({
  phone: z.string().regex(/^[1-9][0-9]{7,14}$/).describe('Digits only with country code, no "+" (e.g. "5531999998888")'),
  name: cappedText(L.maxImportName).optional().describe('Contact name; becomes {{customer_name}} in the messages'),
}).strict();

/**
 * The seller's WhatsApp funnels. The CRUD, the toggle and the contact import go through the same
 * routes the dashboard uses. Importing contacts messages people who never wrote in, so the store
 * must turn on "Permitir acesso pelo MCP" in its inbox settings first (the API refuses otherwise).
 */
export function registerWhatsAppFunnelTools(server: McpServer, service: WhatsAppFunnelService) {
  server.registerTool('list_whatsapp_funnels', {
    description: `List the WhatsApp funnels (id, name, trigger, whether it is enabled, number of steps), newest first, ${L.listMax} per page. Pass nextAfter back as "after" for the next page`,
    inputSchema: {
      limit: z.number().int().min(1).max(L.listMax).optional().describe(`Page size (default ${L.listMax})`),
      after: z.string().max(80).regex(/^[0-9]{1,20}_[0-9a-fA-F-]{36}$/).optional().describe('Cursor: the nextAfter of the previous page'),
    },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('list_whatsapp_funnels', async (args) => service.list(args))));

  server.registerTool('get_whatsapp_funnel', {
    description: 'Get a WhatsApp funnel with every step, its send window, signature and coupon',
    inputSchema: { funnelId },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('get_whatsapp_funnel', async ({ funnelId }) => ({ funnel: await service.get(funnelId) }))));

  server.registerTool('create_whatsapp_funnel', {
    description:
      'Create a WhatsApp funnel: up to 5 messages with a wait between them, sent to one contact by a trigger '
      + '(abandoned cart, unpaid or expired PIX, refused or cancelled card) or by hand (manual). A new funnel may be '
      + 'created already enabled (the answer says isEnabled), and an enabled automatic funnel sends on its own, so confirm '
      + 'the messages with the seller first. A manual funnel needs an operation',
    inputSchema: { ...funnelFields, layout: funnelFields.layout.optional(), sessionGroupId: funnelFields.sessionGroupId.optional() },
  }, createToolHandler('create_whatsapp_funnel', async (input) => ({ success: true, funnel: await service.create(input) })));

  server.registerTool('update_whatsapp_funnel', {
    description:
      'Update a WhatsApp funnel. Only send the fields to change; the rest stays as it is. "steps" replaces the whole list '
      + 'of messages, so send every step to keep',
    inputSchema: {
      funnelId,
      name: funnelFields.name.optional(),
      trigger: funnelFields.trigger.optional(),
      sessionGroupId: funnelFields.sessionGroupId.optional(),
      stopOnReply: funnelFields.stopOnReply.optional(),
      sendWindow: funnelFields.sendWindow.optional(),
      signature: funnelFields.signature.optional(),
      coupon: funnelFields.coupon.optional(),
      useEmoji: funnelFields.useEmoji.optional(),
      steps: funnelFields.steps.optional(),
      layout: funnelFields.layout.optional(),
    },
  }, createToolHandler('update_whatsapp_funnel', async ({ funnelId, ...patch }) => ({
    success: true, funnel: await service.update(funnelId, patch),
  })));

  server.registerTool('delete_whatsapp_funnel', {
    description: 'Delete a WhatsApp funnel. Contacts running it stop receiving its messages',
    inputSchema: { funnelId },
  }, createToolHandler('delete_whatsapp_funnel', async ({ funnelId }) => {
    await service.delete(funnelId);
    return { success: true, message: `Funnel ${funnelId} deleted` };
  }));

  server.registerTool('toggle_whatsapp_funnel', {
    description: 'Turn a WhatsApp funnel on or off. Only one funnel per automatic trigger can be on (409 otherwise): turn the other off first',
    inputSchema: { funnelId, enabled: z.boolean().describe('true to turn it on, false to turn it off') },
  }, createToolHandler('toggle_whatsapp_funnel', async ({ funnelId, enabled }) => ({
    success: true, funnel: await service.toggle(funnelId, enabled),
  })));

  server.registerTool('import_whatsapp_funnel_contacts', {
    description:
      `Start a manual WhatsApp funnel for a batch of up to ${L.importBatch} contacts (phone and optional name). `
      + 'The funnel messages people who did not write in, so the store must turn on "Permitir acesso pelo MCP" in its '
      + 'inbox settings (403 INBOX_API_ACCESS_DISABLED otherwise). Contacts that opted out, have an invalid phone or already '
      + 'run a funnel are skipped; the answer counts each. Send larger lists in several calls',
    inputSchema: {
      funnelId,
      contacts: z.array(importContact).min(1).max(L.importBatch).describe(`1 to ${L.importBatch} contacts`),
    },
  }, createToolHandler('import_whatsapp_funnel_contacts', async ({ funnelId, contacts }) => ({
    success: true, ...(await service.importContacts(funnelId, contacts)),
  })));
}
