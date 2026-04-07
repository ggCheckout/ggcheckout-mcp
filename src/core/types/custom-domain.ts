export interface CustomDomain {
  id: string;
  userId: string;
  domain: string;
  verified: boolean;
  dnsConfigured: boolean;
  createdAt: string;
  verifiedAt?: string;
  dnsRecords?: { CNAME: string; TXT?: string };
}
