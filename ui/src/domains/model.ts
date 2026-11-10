// Turns the custom domain tools into what the domains view draws, following the seller's settings
// (saas-checkout components/settings/CustomDomains): list_custom_domains is the domains card,
// get_custom_domain / add_custom_domain one domain with its DNS instructions, and verify_custom_domain
// the outcome of a check. Pure.

import { isPayload, type Payload } from '../lib/payload';

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

export interface Domain {
  id: string;
  domain: string;
  /** pending, verified, failed or disabled (statusConfig.tsx). */
  status: string;
  createdAt: string | null;
  /** The records to create, CNAME first; empty when the answer did not carry the instructions. */
  records: DnsRecord[];
  notes: string[];
}

function record(r: unknown): DnsRecord | null {
  if (!isPayload(r)) return null;
  const name = text(r.name);
  const value = text(r.value);
  return name && value ? { type: String(r.type ?? ''), name, value } : null;
}

/** DnsInstructionsModal: the pointer (CNAME) always, the TXT only when a legacy domain has one. */
function toDomain(d: Payload): Domain {
  const dns = isPayload(d.dnsInstructions) ? d.dnsInstructions : null;
  return {
    id: String(d.id ?? ''),
    domain: String(d.domain ?? ''),
    status: String(d.status ?? 'pending'),
    createdAt: text(d.createdAt),
    records: [record(dns?.pointer), record(dns?.txt)].filter((r): r is DnsRecord => r !== null),
    notes: (Array.isArray(dns?.notes) ? dns.notes : []).filter((n: unknown): n is string => typeof n === 'string')
      // The first note says "configure only the CNAME below": the view's heading already says it.
      .map((n: string) => n.replace(/^✅\s*/, '')),
  };
}

export interface DomainList {
  domains: Domain[];
  /** The account's cap (5); null when the answer did not say. */
  limit: number | null;
}

/** list_custom_domains; null for anything else. */
export function summarizeDomainList(data: unknown): DomainList | null {
  if (!isPayload(data) || !Array.isArray(data.domains)) return null;
  return {
    domains: data.domains.filter(isPayload).map(toDomain),
    limit: typeof data.limit === 'number' ? data.limit : null,
  };
}

/** get_custom_domain `{ domain }` and add_custom_domain `{ success, domain }`; null for anything else. */
export function summarizeDomain(data: unknown): Domain | null {
  if (!isPayload(data) || !isPayload(data.domain) || typeof data.domain.domain !== 'string') return null;
  return toDomain(data.domain);
}

export interface VerifyOutcome {
  status: 'verified' | 'pending' | 'failed';
  title: string;
  detail: string;
}

/**
 * verify_custom_domain, worded as the dashboard's toasts: verified, or pending with the step still
 * missing (the CNAME not seen yet, or the certificate still being issued), or failed.
 */
export function summarizeVerify(data: unknown): VerifyOutcome | null {
  if (!isPayload(data) || !('checks' in data || 'cloudflare' in data || ('success' in data && 'status' in data))) return null;
  if (data.status === 'verified') {
    return { status: 'verified', title: 'Domínio verificado!', detail: 'DNS configurado corretamente.' };
  }
  if (data.success === false || data.status === 'failed') {
    return { status: 'failed', title: 'Verificação falhou', detail: text(data.error) ?? 'Verifique as configurações de DNS.' };
  }
  const cf = isPayload(data.cloudflare) ? data.cloudflare : null;
  const sslOnly = cf?.hostnameActive === true && cf?.sslActive !== true;
  return {
    status: 'pending',
    title: 'Aguardando propagação DNS',
    detail: sslOnly
      ? 'O CNAME está correto e o certificado SSL ainda está sendo emitido. Isso leva alguns minutos.'
      : 'O CNAME ainda não foi detectado. Confira se o registro está criado no seu provedor de DNS, com o proxy desligado (somente DNS), e aguarde a propagação.',
  };
}

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
  verified: { label: 'Verificado', tone: 'success' },
  pending: { label: 'Pendente', tone: 'warning' },
  failed: { label: 'Falhou', tone: 'danger' },
  disabled: { label: 'Desabilitado', tone: 'muted' },
};

/** statusConfig.tsx */
export function domainStatus(status: string) {
  return STATUS[status] ?? { label: status, tone: 'muted' as const };
}

/** "{current} de {max} domínios utilizados", or null without a cap. */
export function usageLabel(list: DomainList): string | null {
  return list.limit == null ? null : `${list.domains.length} de ${list.limit} domínios utilizados`;
}
