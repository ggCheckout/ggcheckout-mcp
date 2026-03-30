import type { TelegramPort } from '../../core/ports/telegram.port.js';
import type {
  TelegramBotConfig, TelegramFlow, TelegramFlowListItem,
  TelegramLead, TelegramBotGroup, TelegramTokenValidation,
  TelegramMediaUpload, CreateBotInput, UpdateBotInput,
  CreateFlowInput, UpdateFlowInput, ListLeadsQuery, MediaUploadInput,
} from '../../core/types/telegram.js';
import { sanitizeTelegramBot, sanitizeTelegramLead } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

export class TelegramApiAdapter implements TelegramPort {
  constructor(private readonly http: HttpClient) {}

  // --- Bots ---

  async listBots(): Promise<TelegramBotConfig[]> {
    const res = await this.http.get<{ bots: TelegramBotConfig[] }>('/api/telegram/bots');
    return res.bots.map(sanitizeTelegramBot);
  }

  async getBot(botId: string): Promise<TelegramBotConfig> {
    const res = await this.http.get<{ bot: TelegramBotConfig }>(`/api/telegram/bots/${botId}`);
    return sanitizeTelegramBot(res.bot);
  }

  async createBot(input: CreateBotInput): Promise<TelegramBotConfig> {
    const res = await this.http.post<{ bot: TelegramBotConfig }>('/api/telegram/bots', input);
    return sanitizeTelegramBot(res.bot);
  }

  async updateBot(botId: string, input: UpdateBotInput): Promise<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`/api/telegram/bots/${botId}`, input);
  }

  async deleteBot(botId: string): Promise<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/telegram/bots/${botId}`);
  }

  async validateToken(token: string, botId?: string): Promise<TelegramTokenValidation> {
    const url = botId
      ? `/api/telegram/bots/${botId}/validate-token`
      : '/api/telegram/bots/validate-token';
    return this.http.post<TelegramTokenValidation>(url, { token });
  }

  async deployFlow(botId: string, flowId: string): Promise<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`/api/telegram/bots/${botId}/deploy`, { flowId });
  }

  async getBotGroups(botId: string): Promise<TelegramBotGroup[]> {
    const res = await this.http.get<{ groups: TelegramBotGroup[] }>(`/api/telegram/bots/${botId}/groups`);
    return res.groups;
  }

  // --- Flows ---

  async listFlows(botId?: string): Promise<TelegramFlowListItem[]> {
    const params = botId ? `?botId=${botId}` : '';
    const res = await this.http.get<{ flows: TelegramFlowListItem[] }>(`/api/telegram/flows${params}`);
    return res.flows;
  }

  async getFlow(flowId: string): Promise<TelegramFlow> {
    return this.http.get<TelegramFlow>(`/api/telegram/flows/${flowId}`);
  }

  async createFlow(input: CreateFlowInput): Promise<TelegramFlow> {
    const res = await this.http.post<{ flow: TelegramFlow }>('/api/telegram/flows', input);
    return res.flow;
  }

  async updateFlow(flowId: string, input: UpdateFlowInput): Promise<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`/api/telegram/flows/${flowId}`, input);
  }

  async deleteFlow(flowId: string): Promise<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/telegram/flows/${flowId}`);
  }

  // --- Leads ---

  async listLeads(query: ListLeadsQuery): Promise<{ leads: TelegramLead[]; total: number }> {
    const params = new URLSearchParams();
    if (query.botId) params.set('botId', query.botId);
    if (query.flowId) params.set('flowId', query.flowId);
    if (query.status) params.set('status', query.status);
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await this.http.get<{ leads: TelegramLead[]; total: number }>(
      `/api/telegram/leads${qs ? `?${qs}` : ''}`
    );
    return { leads: res.leads.map(sanitizeTelegramLead), total: res.total };
  }

  // --- Media ---

  async uploadMedia(input: MediaUploadInput): Promise<TelegramMediaUpload> {
    const res = await this.http.post<{ success: boolean; data: TelegramMediaUpload }>(
      '/api/telegram/media-upload', input
    );
    return res.data;
  }
}
