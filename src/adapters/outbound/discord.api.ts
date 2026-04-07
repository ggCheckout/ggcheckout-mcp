import type { DiscordPort } from '../../core/ports/discord.port.js';
import type { DiscordConnection, DiscordChannel, DiscordCategory, DiscordRole } from '../../core/types/discord.js';
import type { HttpClient } from './http-client.js';

export class DiscordApiAdapter implements DiscordPort {
  constructor(private readonly http: HttpClient) {}
  async listConnections() {
    const data = await this.http.get<{ connections: DiscordConnection[] }>('/api/discord/connections');
    return data.connections;
  }
  async createConnection(input: any) {
    const data = await this.http.post<{ success: boolean; connection: DiscordConnection }>('/api/discord/connections', input);
    return data.connection;
  }
  async updateConnection(id: string, settings: DiscordConnection['settings']) {
    await this.http.patch(`/api/discord/connections/${id}`, { settings });
  }
  async deleteConnection(id: string) { await this.http.delete(`/api/discord/connections/${id}`); }
  async getGuildChannels(guildId: string) {
    return this.http.get<{ textChannels: DiscordChannel[]; categories: DiscordCategory[] }>(`/api/discord/guild/${guildId}/channels`);
  }
  async getGuildRoles(guildId: string) {
    const data = await this.http.get<{ roles: DiscordRole[] }>(`/api/discord/guild/${guildId}/roles`);
    return data.roles;
  }
  async createPrivateChannel(guildId: string) {
    const data = await this.http.post<{ success: boolean; channel: { id: string; name: string } }>(`/api/discord/guild/${guildId}/create-private-channel`);
    return data.channel;
  }
}
