import type {
  TelegramBotConfig, TelegramFlow, TelegramFlowListItem,
  TelegramLead, TelegramBotGroup, TelegramTokenValidation,
  TelegramMediaUpload, CreateBotInput, UpdateBotInput,
  CreateFlowInput, UpdateFlowInput, ListLeadsQuery, MediaUploadInput,
} from '../types/telegram.js';

export interface TelegramPort {
  // Bots
  listBots(): Promise<TelegramBotConfig[]>;
  getBot(botId: string): Promise<TelegramBotConfig>;
  createBot(input: CreateBotInput): Promise<TelegramBotConfig>;
  updateBot(botId: string, input: UpdateBotInput): Promise<{ success: boolean }>;
  deleteBot(botId: string): Promise<{ success: boolean }>;
  validateToken(token: string, botId?: string): Promise<TelegramTokenValidation>;
  deployFlow(botId: string, flowId: string): Promise<{ success: boolean }>;
  getBotGroups(botId: string): Promise<TelegramBotGroup[]>;

  // Flows
  listFlows(botId?: string): Promise<TelegramFlowListItem[]>;
  getFlow(flowId: string): Promise<TelegramFlow>;
  createFlow(input: CreateFlowInput): Promise<TelegramFlow>;
  updateFlow(flowId: string, input: UpdateFlowInput): Promise<{ success: boolean }>;
  deleteFlow(flowId: string): Promise<{ success: boolean }>;

  // Leads
  listLeads(query: ListLeadsQuery): Promise<{ leads: TelegramLead[]; total: number }>;

  // Media
  uploadMedia(input: MediaUploadInput): Promise<TelegramMediaUpload>;
}
