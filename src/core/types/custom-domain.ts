/** A DNS record the seller creates at their DNS provider. An empty `value` means none is needed. */
export interface DnsRecord {
  name: string;
  value: string;
  type: 'CNAME' | 'A' | 'TXT';
}

export interface DnsInstructions {
  type: 'subdomain' | 'apex';
  /** The record that points the domain to the platform: a CNAME to pay.ggcheckout.app. */
  pointer: DnsRecord;
  /** Only legacy (Vercel) domains have a TXT to create; for the others name and value are empty. */
  txt: DnsRecord;
  notes: string[];
}

export type CustomDomainStatus = 'pending' | 'verified' | 'failed' | 'disabled';

/** As `/api/custom-domains` answers it; the list leaves `dnsInstructions` out. */
export interface CustomDomain {
  id: string;
  domain: string;
  status: CustomDomainStatus;
  type?: 'subdomain' | 'apex';
  provider?: 'cloudflare' | 'vercel';
  createdAt: string;
  updatedAt?: string;
  dnsInstructions?: DnsInstructions;
}

/** `POST /api/custom-domains/{id}/verify`: verified once Cloudflare has the hostname and its SSL active. */
export interface CustomDomainVerification {
  success: boolean;
  status: CustomDomainStatus;
  checks?: {
    txt: { valid: boolean; expected: string };
    pointer: { valid: boolean; expected: string; type: 'CNAME' };
  };
  cloudflare?: { hostnameStatus: string; sslStatus: string; hostnameActive: boolean; sslActive: boolean };
  message?: string;
  error?: string;
}
