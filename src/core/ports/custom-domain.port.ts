import type { CustomDomain } from '../types/custom-domain.js';
export interface CustomDomainPort {
  list(): Promise<{ domains: CustomDomain[]; total: number }>;
  add(domain: string): Promise<CustomDomain>;
  getById(id: string): Promise<CustomDomain>;
  delete(id: string): Promise<void>;
  verify(id: string): Promise<{ success: boolean; verified: boolean }>;
}
