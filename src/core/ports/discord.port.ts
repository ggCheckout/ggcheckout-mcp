import type { DiscordConnection, DiscordChannel, DiscordCategory, DiscordRole } from '../types/discord.js';

export interface DiscordPort {
  listConnections(): Promise<DiscordConnection[]>;
  createConnection(input: any): Promise<DiscordConnection>;
  updateConnection(id: string, settings: DiscordConnection['settings']): Promise<void>;
  deleteConnection(id: string): Promise<void>;
  getGuildChannels(guildId: string): Promise<{ textChannels: DiscordChannel[]; categories: DiscordCategory[] }>;
  getGuildRoles(guildId: string): Promise<DiscordRole[]>;
  createPrivateChannel(guildId: string): Promise<{ id: string; name: string }>;
}
