import type { GatewayPort } from '../ports/gateway.port.js';
import type { InsertTokenInput, GatewayFallbackStats } from '../types/gateway.js';

export class GatewayService {
  constructor(private readonly port: GatewayPort) {}
  async listTokens(options?: { type?: string }) { return this.port.listTokens(options); }
  async insertToken(input: InsertTokenInput) { return this.port.insertToken(input); }
  async deleteToken(tokenId: string, target: string, token: string, type: string) { return this.port.deleteToken(tokenId, target, token, type); }
  async getFallbackStats(): Promise<GatewayFallbackStats> { return this.port.getFallbackStats(); }
}
