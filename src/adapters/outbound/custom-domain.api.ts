import type { CustomDomainPort } from '../../core/ports/custom-domain.port.js';
import type { CustomDomain, CustomDomainVerification } from '../../core/types/custom-domain.js';
import type { HttpClient } from './http-client.js';

const route = (id: string) => `/api/custom-domains/${encodeURIComponent(id)}`;

export class CustomDomainApiAdapter implements CustomDomainPort {
  constructor(private readonly http: HttpClient) {}
  async list() { return this.http.get<{ domains: CustomDomain[]; total: number; limit: number }>('/api/custom-domains'); }
  async add(domain: string) { return this.http.post<CustomDomain>('/api/custom-domains', { domain }); }
  async getById(id: string) { return this.http.get<CustomDomain>(route(id)); }
  async delete(id: string) { await this.http.delete(route(id)); }
  async verify(id: string) { return this.http.post<CustomDomainVerification>(`${route(id)}/verify`); }
}
