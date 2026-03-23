import type { CustomDomainPort } from '../ports/custom-domain.port.js';
export class CustomDomainService {
  constructor(private readonly port: CustomDomainPort) {}
  async list() { return this.port.list(); }
  async add(domain: string) { return this.port.add(domain); }
  async getById(id: string) { return this.port.getById(id); }
  async delete(id: string) { return this.port.delete(id); }
  async verify(id: string) { return this.port.verify(id); }
}
