import type { ProfilePort } from '../../core/ports/profile.port.js';
import type { UserProfile, SupportEmail, KycStatus } from '../../core/types/profile.js';
import type { HttpClient } from './http-client.js';

export class ProfileApiAdapter implements ProfilePort {
  constructor(private readonly http: HttpClient) {}
  async getProfile() { return this.http.get<UserProfile>('/api/user/profile'); }
  async updateProfile(input: any) { return this.http.patch<any>('/api/user/profile', input); }
  async listSupportEmails(userId: string) {
    const data = await this.http.get<{ supportEmails: SupportEmail[] }>(`/api/user/support-emails?userId=${userId}`);
    return data.supportEmails;
  }
  async addSupportEmail(userId: string, name: string, email: string) {
    const data = await this.http.post<{ success: boolean; supportEmail: SupportEmail }>('/api/user/support-emails', { userId, name, email });
    return data.supportEmail;
  }
  async deleteSupportEmail(userId: string, emailId: string) {
    await this.http.delete(`/api/user/support-emails?userId=${userId}&emailId=${emailId}`);
  }
  async getKycStatus(businessId: string) { return this.http.get<KycStatus>(`/api/kyc/status?businessId=${businessId}`); }
}
