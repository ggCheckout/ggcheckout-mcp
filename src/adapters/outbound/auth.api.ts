import type { AuthPort } from '../../core/ports/auth.port.js';
import type { HttpClient } from './http-client.js';

export class AuthApiAdapter implements AuthPort {
  constructor(private readonly http: HttpClient) {}

  async getMyBusinessId(): Promise<string> {
    const data = await this.http.get<{ businessId: string }>('/api/me');
    return data.businessId;
  }
}
