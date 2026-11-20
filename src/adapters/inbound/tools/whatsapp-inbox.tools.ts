import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WhatsAppInboxService } from '../../../core/services/whatsapp-inbox.service.js';
import { INBOX_LIMITS, type InboxState, type InboxSummary } from '../../../core/types/whatsapp-inbox.js';
import { createToolHandler, type ToolResult } from '../tool-handler.js';
import { appMeta, appOnlyMeta, whenAppsSupported } from '../apps/apps.js';
import { codePoints, contactKey, funnelVariables, guid } from './whatsapp-schemas.js';

const APP_ONLY = 'App only: the WhatsApp inbox view calls it, the model does not.';

/** What the model is told after `open_whatsapp_inbox`: the seller's next step, never a conversation. */
const NOTES: Record<InboxState, string> = {
  ready: 'A caixa de entrada do WhatsApp está aberta na tela do chat, onde o lojista lê e responde. Você só tem as contagens acima: '
    + 'não há nomes, telefones nem textos de conversa no seu contexto. Responda em uma frase com as contagens; com truncated true, elas são das 200 conversas mais recentes e há mais.',
  off: 'O acesso do MCP à caixa está desligado. Diga ao lojista para ligar "Permitir acesso pelo MCP" nas configurações da '
    + 'caixa de entrada, no painel (só ele pode ligar), e pedir de novo.',
  unavailable: 'A caixa de entrada do WhatsApp ainda não está disponível nesta conta. Diga isso ao lojista.',
  terms_required: 'A caixa ainda não tem o termo aceito. Diga ao lojista para aceitar o termo da caixa de entrada no painel '
    + '(o MCP nunca aceita o termo pela loja) e pedir de novo.',
};

/**
 * The inbox is for the seller's eyes, not the model's. Every tool that returns a customer name,
 * phone or message text, or sends a message, is app-only and exists only for a client that draws MCP
 * Apps; the model gets `open_whatsapp_inbox`, which answers counts and nothing else. A customer
 * message therefore never enters the model context, so it cannot be a prompt injection, and the
 * model can neither read a conversation nor answer one.
 */
export function registerWhatsAppInboxTools(server: McpServer, service: WhatsAppInboxService) {
  whenAppsSupported(server, () => {
    server.registerTool('open_whatsapp_inbox', {
      description:
        'Open the seller\'s WhatsApp inbox (conversations, replies, funnels per conversation) in a view in the chat. '
        + 'The seller reads and answers there; you get only whether it is available and on, how many conversations and how '
        + 'many unread messages, never names, phones or message text. If it is off, the seller turns on "Permitir acesso '
        + 'pelo MCP" in the dashboard inbox settings.',
      _meta: appMeta(),
    }, async (): Promise<ToolResult> => {
      let state: InboxState = 'ready';
      const handled = await createToolHandler('open_whatsapp_inbox', async () => {
        const answer = await service.summarize();
        state = answer.state;
        const { available, enabled, conversations, unread, truncated }: InboxSummary = answer.summary;
        // Five fields by name: nothing else the service returns can reach the model.
        return { available, enabled, conversations, unread, truncated };
      })({});
      if (handled.isError) return handled;
      return { ...handled, content: [handled.content[0], { type: 'text', text: NOTES[state] }, ...handled.content.slice(1)] };
    });

    server.registerTool('list_whatsapp_conversations', {
      description: `${APP_ONLY} List the inbox conversations, newest first: contact name or key, last text, unread count, labels.`,
      inputSchema: {
        limit: z.number().int().min(1).max(INBOX_LIMITS.conversationsPage).optional().describe(`Page size (default ${INBOX_LIMITS.conversationsPage})`),
        before: z.string().max(160).regex(/^(?:0|[1-9][0-9]*):.+$/).optional().describe('Cursor: the nextBefore of the previous page'),
        includeAutomatic: z.boolean().optional().describe('Also list conversations only the platform started (default false)'),
      },
      _meta: appOnlyMeta(),
    }, createToolHandler('list_whatsapp_conversations', async (args) => service.listConversations(args)));

    server.registerTool('list_whatsapp_messages', {
      description: `${APP_ONLY} List the messages of one conversation, newest first.`,
      inputSchema: {
        contactKey,
        limit: z.number().int().min(1).max(INBOX_LIMITS.messagesPage).optional().describe(`Page size (default ${INBOX_LIMITS.messagesPage})`),
        before: z.string().max(41).regex(/^[0-9]{1,20}-[0-9]{1,20}$/).optional().describe('Cursor: the nextBefore of the previous page'),
      },
      _meta: appOnlyMeta(),
    }, createToolHandler('list_whatsapp_messages', async ({ contactKey, ...query }) => service.listMessages(contactKey, query)));

    server.registerTool('send_whatsapp_reply', {
      description: `${APP_ONLY} Send a reply in a conversation. clientMessageId is made once per message and sent again unchanged on a retry, so a retry never doubles the message.`,
      inputSchema: {
        contactKey,
        text: z.string()
          .refine((text) => text.trim().length > 0, { message: 'Message must not be empty' })
          .refine((text) => codePoints(text) <= INBOX_LIMITS.replyMaxChars, { message: `At most ${INBOX_LIMITS.replyMaxChars} characters` })
          .describe(`Message text, up to ${INBOX_LIMITS.replyMaxChars} characters`),
        clientMessageId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).describe('Idempotency id, one per message'),
        chipId: guid().optional().describe('Chip to send with; absent keeps the conversation\'s chip'),
      },
      _meta: appOnlyMeta(),
    }, createToolHandler('send_whatsapp_reply', async ({ contactKey, ...input }) => ({ message: await service.sendReply(contactKey, input) })));

    server.registerTool('mark_whatsapp_conversation_read', {
      description: `${APP_ONLY} Mark a conversation as read.`,
      inputSchema: { contactKey },
      _meta: appOnlyMeta(),
    }, createToolHandler('mark_whatsapp_conversation_read', async ({ contactKey }) => service.markRead(contactKey)));

    server.registerTool('get_whatsapp_conversation_funnel', {
      description: `${APP_ONLY} The funnel run of a conversation (the running one or the latest): step n of m, next send.`,
      inputSchema: { contactKey },
      _meta: appOnlyMeta(),
    }, createToolHandler('get_whatsapp_conversation_funnel', async ({ contactKey }) => service.getContactRun(contactKey)));

    server.registerTool('start_whatsapp_conversation_funnel', {
      description: `${APP_ONLY} Run an enabled manual funnel for a conversation's contact; a funnel already running for them ends as replaced.`,
      inputSchema: {
        contactKey,
        funnelId: guid().describe('Manual funnel to run'),
        variables: funnelVariables.optional().describe('Values for the funnel variables'),
      },
      _meta: appOnlyMeta(),
    }, createToolHandler('start_whatsapp_conversation_funnel', async ({ contactKey, funnelId, variables }) => service.startRun(contactKey, funnelId, variables)));

    server.registerTool('stop_whatsapp_conversation_funnel', {
      description: `${APP_ONLY} Stop the funnel running for a conversation's contact. Fails when none is running.`,
      inputSchema: { contactKey },
      _meta: appOnlyMeta(),
    }, createToolHandler('stop_whatsapp_conversation_funnel', async ({ contactKey }) => service.stopRun(contactKey)));

    server.registerTool('set_whatsapp_conversation_opt_out', {
      description: `${APP_ONLY} optedOut true stops the contact's running funnels and every future send to them; false lets sends resume (a stopped funnel stays stopped).`,
      inputSchema: { contactKey, optedOut: z.boolean() },
      _meta: appOnlyMeta(),
    }, createToolHandler('set_whatsapp_conversation_opt_out', async ({ contactKey, optedOut }) => service.setOptOut(contactKey, optedOut)));
  });
}
