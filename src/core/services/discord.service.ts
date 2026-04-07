import type { DiscordPort } from '../ports/discord.port.js';
import type { DiscordConnection } from '../types/discord.js';

export class DiscordService {
  constructor(private readonly port: DiscordPort) {}
  async listConnections() { return this.port.listConnections(); }
  async createConnection(input: any) { return this.port.createConnection(input); }
  async updateConnection(id: string, settings: DiscordConnection['settings']) { return this.port.updateConnection(id, settings); }
  async deleteConnection(id: string) { return this.port.deleteConnection(id); }
  async getGuildChannels(guildId: string) { return this.port.getGuildChannels(guildId); }
  async getGuildRoles(guildId: string) { return this.port.getGuildRoles(guildId); }
  async createPrivateChannel(guildId: string) { return this.port.createPrivateChannel(guildId); }
}
