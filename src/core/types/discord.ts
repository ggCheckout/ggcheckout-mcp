export interface DiscordConnection {
  id: string;
  ownerId: string;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  discordUserId: string;
  discordUsername: string;
  discordAvatar: string | null;
  connectedAt: string;
  status: 'active';
  settings: {
    salesChannelId?: string | null;
    salesChannelName?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    logChannelId?: string | null;
    roleOnPurchase?: string | null;
    roleOnPurchaseName?: string | null;
    rolesOnPurchase?: string[] | null;
    rolesOnPurchaseNames?: string[] | null;
    language?: 'pt' | 'en' | 'es' | null;
  };
}

export interface DiscordChannel { id: string; name: string; type: string; parentId?: string; position: number; }
export interface DiscordCategory { id: string; name: string; type: string; position: number; }
export interface DiscordRole { id: string; name: string; color: string; position: number; }
