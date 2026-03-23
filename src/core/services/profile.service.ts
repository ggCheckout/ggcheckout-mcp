import type { AuthPort } from '../ports/auth.port.js';
import type { ProfilePort } from '../ports/profile.port.js';
import type { UserProfile } from '../types/profile.js';
export class ProfileService {
  constructor(private readonly port: ProfilePort, private readonly authPort: AuthPort) {}
  async getProfile() { return this.port.getProfile(); }
  async updateProfile(input: Partial<Pick<UserProfile, 'name' | 'displayName' | 'phone' | 'phoneCountryCode' | 'countryCode'>>) { return this.port.updateProfile(input); }
  async listSupportEmails() { const uid = await this.authPort.getMyBusinessId(); return this.port.listSupportEmails(uid); }
  async addSupportEmail(name: string, email: string) { const uid = await this.authPort.getMyBusinessId(); return this.port.addSupportEmail(uid, name, email); }
  async deleteSupportEmail(emailId: string) { const uid = await this.authPort.getMyBusinessId(); return this.port.deleteSupportEmail(uid, emailId); }
  async getKycStatus() { const uid = await this.authPort.getMyBusinessId(); return this.port.getKycStatus(uid); }
}
