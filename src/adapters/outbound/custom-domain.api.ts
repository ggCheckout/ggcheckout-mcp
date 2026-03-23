import type { CustomDomainPort } from '../../core/ports/custom-domain.port.js';
import type { CustomDomain } from '../../core/types/custom-domain.js';
import type { HttpClient } from './http-client.js';

export class CustomDomainApiAdapter implements CustomDomainPort {
  constructor(private readonly http: HttpClient) {}
  async list() { return this.http.get<{ domains: CustomDomain[]; total: number }>('/api/custom-domains'); }
  async add(domain: string) { return this.http.post<CustomDomain>('/api/custom-domains', { domain }); }
  async getById(id: string) { return this.http.get<CustomDomain>(`/api/custom-domains/${id}`); }
  async delete(id: string) { await this.http.delete(`/api/custom-domains/${id}`); }
  async verify(id: string) { return this.http.post<{ success: boolean; verified: boolean }>(`/api/custom-domains/${id}/verify`); }
}
