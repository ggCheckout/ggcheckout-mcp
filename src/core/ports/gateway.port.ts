import type { GatewayToken, InsertTokenInput } from '../types/gateway.js';

export interface GatewayPort {
  listTokens(options?: { type?: string }): Promise<{ tokens: GatewayToken[]; count: number }>;
  insertToken(input: InsertTokenInput): Promise<void>;
  deleteToken(tokenId: string, target: string, token: string, type: string): Promise<void>;
}
