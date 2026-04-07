import type { TelegramPort } from '../ports/telegram.port.js';
import type {
  CreateBotInput, UpdateBotInput, CreateFlowInput,
  UpdateFlowInput, ListLeadsQuery, MediaUploadInput,
} from '../types/telegram.js';

export class TelegramService {
  constructor(private readonly telegramPort: TelegramPort) {}

  listBots() { return this.telegramPort.listBots(); }
  getBot(botId: string) { return this.telegramPort.getBot(botId); }
  createBot(input: CreateBotInput) { return this.telegramPort.createBot(input); }
  updateBot(botId: string, input: UpdateBotInput) { return this.telegramPort.updateBot(botId, input); }
  deleteBot(botId: string) { return this.telegramPort.deleteBot(botId); }
  validateToken(token: string, botId?: string) { return this.telegramPort.validateToken(token, botId); }
  deployFlow(botId: string, flowId: string) { return this.telegramPort.deployFlow(botId, flowId); }
  getBotGroups(botId: string) { return this.telegramPort.getBotGroups(botId); }

  listFlows(botId?: string) { return this.telegramPort.listFlows(botId); }
  getFlow(flowId: string) { return this.telegramPort.getFlow(flowId); }
  createFlow(input: CreateFlowInput) { return this.telegramPort.createFlow(input); }
  updateFlow(flowId: string, input: UpdateFlowInput) { return this.telegramPort.updateFlow(flowId, input); }
  deleteFlow(flowId: string) { return this.telegramPort.deleteFlow(flowId); }

  listLeads(query: ListLeadsQuery) { return this.telegramPort.listLeads(query); }

  uploadMedia(input: MediaUploadInput) { return this.telegramPort.uploadMedia(input); }
}
