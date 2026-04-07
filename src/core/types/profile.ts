export interface UserProfile {
  uid: string;
  name: string;
  displayName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  documentCountryCode?: string;
  countryCode: string;
  profilePicture: string | null;
  hasCompletedProfile: boolean;
  needsCpfUpdate: boolean;
  needsPhoneUpdate: boolean;
  isStudent: boolean;
}

export interface SupportEmail {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  verificationToken?: string;
  verificationSentAt?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface KycStatus {
  success: boolean;
  kycStatus: 'pending' | 'in_progress' | 'approved' | 'rejected';
  approved: boolean;
  sessionId?: string;
  verifiedAt?: string;
}
