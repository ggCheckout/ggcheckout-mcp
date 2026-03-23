import type { GatewayPort } from '../../core/ports/gateway.port.js';
import type { GatewayToken, InsertTokenInput } from '../../core/types/gateway.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';
import { sanitizeGatewayToken } from '../../shared/sanitizer.js';

export class GatewayApiAdapter implements GatewayPort {
  constructor(private readonly http: HttpClient, private readonly authPort: AuthPort) {}

  async listTokens(options?: { type?: string }) {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    const qs = params.toString();
    const data = await this.http.get<{ tokens: GatewayToken[]; count: number }>(`/api/user/tokens${qs ? `?${qs}` : ''}`);
    return { ...data, tokens: data.tokens.map(sanitizeGatewayToken) };
  }
  async insertToken(input: InsertTokenInput) {
    const userId = await this.authPort.getMyBusinessId();
    await this.http.post('/api/insert-token', { userId, ...input });
  }
  async deleteToken(tokenId: string, target: string, token: string, type: string) {
    const userId = await this.authPort.getMyBusinessId();
    await this.http.post('/api/delete-token', { userId, tokenId, target, token, type, product: '', status: 'active' });
  }
}
