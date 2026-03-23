import type { UserProfile, SupportEmail, KycStatus } from '../types/profile.js';
export interface ProfilePort {
  getProfile(): Promise<UserProfile>;
  updateProfile(input: Partial<Pick<UserProfile, 'name' | 'displayName' | 'phone' | 'phoneCountryCode' | 'countryCode'>>): Promise<any>;
  listSupportEmails(userId: string): Promise<SupportEmail[]>;
  addSupportEmail(userId: string, name: string, email: string): Promise<SupportEmail>;
  deleteSupportEmail(userId: string, emailId: string): Promise<void>;
  getKycStatus(businessId: string): Promise<KycStatus>;
}
