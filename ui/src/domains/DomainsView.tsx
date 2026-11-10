import { Check, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import './domains.css';
import domainsIcon from '../art/icon-domains.avif';
import type { Host, HostSnapshot } from '../host';
import { BackButton } from '../lib/BackButton';
import { formatDateTime } from '../lib/format';
import { messageOf } from '../lib/messageOf';
import { COPY_FAILED_TEXT, useCopy } from '../lib/useCopy';
import {
  domainStatus, summarizeDomain, summarizeDomainList, summarizeVerify, usageLabel,
  type DnsRecord, type Domain, type DomainList, type VerifyOutcome,
} from './model';

function StatusBadge({ status }: { status: string }) {
  const { label, tone } = domainStatus(status);
  return <span className="dom-badge" data-tone={tone}>{label}</span>;
}

/** The dashboard's alert under a domain that is not live yet. */
function StatusAlert({ status }: { status: string }) {
  if (status === 'pending') {
    return <p className="dom-alert" data-tone="warning">Aguardando configuração DNS. Configure conforme as instruções e clique em "Verificar DNS".</p>;
  }
  if (status === 'failed') {
    return <p className="dom-alert" data-tone="danger">Verificação falhou. Verifique as configurações DNS e tente novamente.</p>;
  }
  return null;
}

/** A value of the DNS card: mono, copied on click ("Clique para copiar"). */
function CopyValue({ value }: { value: string }) {
  const [state, copy] = useCopy();
  const copied = state === 'copied';
  return (
    <button type="button" className="dom-copy mono" title="Clique para copiar" onClick={() => void copy(value)}>
      <span>{value}</span>
      {copied ? <Check size={14} className="dom-copied" aria-label="Copiado!" /> : <Copy size={14} aria-hidden />}
      {state === 'failed' && <span className="copy-failed" role="status">{COPY_FAILED_TEXT}</span>}
    </button>
  );
}

function RecordCard({ record, n }: { record: DnsRecord; n: number }) {
  const title = record.type === 'CNAME' ? 'Registro CNAME (Apontamento)' : `Registro ${record.type}`;
  return (
    <section className="dom-record">
      <h3>{`${n}. ${title}`}</h3>
      <dl>
        <div><dt>Tipo:</dt><dd className="mono">{record.type}</dd></div>
        <div><dt>Nome:</dt><dd><CopyValue value={record.name} /></dd></div>
        <div><dt>Valor:</dt><dd><CopyValue value={record.value} /></dd></div>
      </dl>
    </section>
  );
}

function Outcome({ outcome }: { outcome: VerifyOutcome }) {
  return (
    <div className="dom-outcome" data-tone={outcome.status} role="status">
      <p className="dom-outcome-title">{outcome.title}</p>
      <p>{outcome.detail}</p>
    </div>
  );
}

/** One domain: its state and the DnsInstructionsModal's content, with "Verificar DNS" through the host. */
function DomainDetail({ host, first, canCallTools, firstOutcome = null, onBack }: {
  host: Host; first: Domain; canCallTools: boolean; firstOutcome?: VerifyOutcome | null; onBack?: () => void;
}) {
  const [domain, setDomain] = useState(first);
  const [outcome, setOutcome] = useState(firstOutcome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = summarizeVerify(await host.callTool('verify_custom_domain', { domainId: domain.id }));
      if (next) setOutcome(next);
      const fresh = summarizeDomain(await host.callTool('get_custom_domain', { domainId: domain.id }));
      if (fresh) setDomain(fresh);
      host.tellModel(`Verificação do domínio ${domain.domain} na tela do chat: ${next?.title ?? 'sem resposta'}.`);
    } catch (e) {
      const message = messageOf(e);
      setError(/429|rate|limit/i.test(message)
        ? 'Você pode verificar um domínio até 10 vezes por minuto. Aguarde um instante e tente novamente.'
        : 'Não foi possível verificar agora. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dom-detail">
      {onBack && <BackButton onBack={onBack} />}
      <section className="surface dom-card">
        <header className="dom-detail-head">
          <div className="dom-name-row">
            <h2 className="dom-name">{domain.domain}</h2>
            <StatusBadge status={domain.status} />
          </div>
          <p className="card-sub num">{`Criado em ${formatDateTime(domain.createdAt, { seconds: true })}`}</p>
        </header>
        {outcome && <Outcome outcome={outcome} />}
        {error && <p className="dom-alert" data-tone="danger" role="alert">{error}</p>}
        {/* The check's outcome already says what is missing. */}
        {!outcome && <StatusAlert status={domain.status} />}
        {domain.records.length > 0 && (
          <>
            <h3 className="dom-section">Instruções de Configuração DNS</h3>
            <p className="dom-hint">Configure apenas o registro CNAME abaixo. Se você usa Cloudflare como DNS, deixe o Proxy desligado (DNS only, nuvem cinza).</p>
            {domain.records.map((r, i) => <RecordCard key={`${r.type}-${r.name}`} record={r} n={i + 1} />)}
          </>
        )}
        {domain.notes.length > 0 && (
          <div className="dom-notes">
            <p className="dom-notes-title">Observações Importantes:</p>
            <ul>{domain.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </div>
        )}
        {canCallTools && domain.status !== 'verified' && (
          <button type="button" className="cta dom-verify" disabled={busy} onClick={verify}>
            <RefreshCw size={16} className={busy ? 'dom-spin' : undefined} aria-hidden />
            {busy ? 'Verificando…' : 'Verificar DNS'}
          </button>
        )}
      </section>
    </div>
  );
}

/** The domains card of the settings: the counter, a row per domain that opens its instructions. */
function DomainsList({ list, canOpen, busyId, onOpen }: {
  list: DomainList; canOpen: boolean; busyId: string | null; onOpen: (domain: Domain) => void;
}) {
  const usage = usageLabel(list);
  return (
    <section className="surface dom-card">
      <header className="dom-list-head">
        <div>
          <h2 className="card-title">Domínios Customizados</h2>
          <p className="card-sub">Configure domínios personalizados para seus checkouts</p>
        </div>
        {usage && <span className="dom-usage num">{usage}</span>}
      </header>
      {list.domains.length ? (
        <ul className="dom-rows">
          {list.domains.map((d) => {
            const { tone } = domainStatus(d.status);
            const body = (
              <>
                <span className="dom-row-main">
                  <span className="dom-name-row"><span className="dom-name small">{d.domain}</span><StatusBadge status={d.status} /></span>
                  <span className="card-sub num">{`Criado em ${formatDateTime(d.createdAt, { seconds: true })}`}</span>
                  <StatusAlert status={d.status} />
                </span>
                {canOpen && <ChevronRight size={16} className="dom-chevron" aria-hidden />}
              </>
            );
            return (
              <li key={d.id} className="dom-row" data-accent={tone} aria-busy={busyId === d.id || undefined}>
                {canOpen
                  ? <button type="button" className="dom-row-btn" onClick={() => onOpen(d)} aria-label={`Ver instruções DNS de ${d.domain}`}>{body}</button>
                  : <div className="dom-row-btn">{body}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="dom-empty">
          <img src={domainsIcon} width={56} height={56} alt="" />
          <p>Nenhum domínio encontrado</p>
        </div>
      )}
    </section>
  );
}

/** Domains view: list_custom_domains, get_custom_domain / add_custom_domain and verify_custom_domain. */
export function DomainsView({ host, state }: { host: Host; state: HostSnapshot }) {
  const parts = useMemo(() => {
    const domain = summarizeDomain(state.payload);
    const list = domain ? null : summarizeDomainList(state.payload);
    const outcome = domain || list ? null : summarizeVerify(state.payload);
    return { domain, list, outcome };
  }, [state.payload]);
  const [open, setOpen] = useState<Domain | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const domainId = typeof state.args.domainId === 'string' ? state.args.domainId : null;

  // verify_custom_domain answers the check alone: the domain is read again to draw it.
  useEffect(() => {
    if (!parts.outcome || !domainId || !state.canCallTools) return;
    host.callTool('get_custom_domain', { domainId })
      .then((data) => setOpen(summarizeDomain(data)))
      .catch(() => setFailed(true));
  }, [host, parts.outcome, domainId, state.canCallTools]);

  useEffect(() => {
    if (parts.domain) host.tellModel(`Instruções DNS do domínio ${parts.domain.domain} abertas na tela do chat.`);
    else if (parts.list) host.tellModel('Lista de domínios customizados aberta na tela do chat.');
  }, [host, parts]);

  async function openDomain(d: Domain) {
    setBusyId(d.id);
    setFailed(false);
    try {
      const full = summarizeDomain(await host.callTool('get_custom_domain', { domainId: d.id }));
      if (!full) throw new Error('no domain');
      setOpen(full);
      host.tellModel(`O vendedor abriu as instruções DNS de ${d.domain} na tela do chat.`);
    } catch {
      setFailed(true);
    } finally {
      setBusyId(null);
    }
  }

  const { domain, list, outcome } = parts;
  if (!domain && !list && !outcome) return <p className="state" data-tone="error">A resposta não trouxe domínios.</p>;
  return (
    <div className="dashboard domains">
      {failed && <p className="dom-alert" data-tone="danger" role="alert">Não foi possível carregar o domínio. Tente novamente.</p>}
      {domain && <DomainDetail host={host} first={domain} canCallTools={state.canCallTools} />}
      {list && (
        <>
          {open && <DomainDetail key={open.id} host={host} first={open} canCallTools={state.canCallTools} onBack={() => setOpen(null)} />}
          <div hidden={Boolean(open)}>
            <DomainsList list={list} canOpen={state.canCallTools} busyId={busyId} onOpen={openDomain} />
          </div>
        </>
      )}
      {outcome && (open
        ? <DomainDetail key={open.id} host={host} first={open} canCallTools={state.canCallTools} firstOutcome={outcome} />
        : <section className="surface dom-card"><Outcome outcome={outcome} /></section>)}
    </div>
  );
}
