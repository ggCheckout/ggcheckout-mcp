import { Check, Copy, Link2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import '../styles/dashboard.css';
import './utm.css';
import type { Host, HostSnapshot } from '../host';
import { ViewHeader } from '../dashboard/parts';
import { Field } from '../lib/Field';
import { COPY_FAILED_TEXT, useCopy } from '../lib/useCopy';
import { SOURCE_LABELS, summarizeLink, type UtmLink } from './model';

/** A value copied on click, with its own copied and failed state. */
function CopyButton({ value, label, primary = false }: { value: string; label: string; primary?: boolean }) {
  const [state, copy] = useCopy();
  const Icon = state === 'copied' ? Check : Copy;
  return (
    <span className="utm-copy-wrap">
      <button type="button" className={primary ? 'cta utm-copy' : 'utm-copy utm-copy-quiet'} onClick={() => void copy(value)}>
        <Icon size={16} aria-hidden />
        {state === 'copied' ? 'Copiado' : label}
      </button>
      <span className="copy-failed" role="status">{state === 'failed' ? COPY_FAILED_TEXT : ''}</span>
    </span>
  );
}

function Paste({ link }: { link: UtmLink }) {
  return (
    <section className="surface utm-card" aria-labelledby="utm-paste">
      <h2 className="utm-h" id="utm-paste">{link.paste.label}</h2>
      <p className="utm-code mono" data-testid="utm-paste-text">{link.paste.text}</p>
      <CopyButton value={link.paste.text} label="Copiar" primary />
    </section>
  );
}

function Destination({ link }: { link: UtmLink }) {
  const { destination } = link;
  return (
    <section className="surface utm-card" aria-labelledby="utm-dest">
      <h2 className="utm-h" id="utm-dest">Destino</h2>
      <dl className="utm-fields">
        <Field label="Tipo">{destination.kindLabel}</Field>
        {destination.title && <Field label="Nome">{destination.title}</Field>}
        <Field label="Domínio">{destination.customDomain ? 'Domínio próprio' : 'Endereço padrão da GG'}</Field>
        <Field label="Plataforma">{link.platformLabel}</Field>
        <Field label="URL limpa" valueClassName="utm-url mono">{destination.url}</Field>
      </dl>
      <CopyButton value={destination.url} label="Copiar URL limpa" />
    </section>
  );
}

function Steps({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <section className="surface utm-card" aria-labelledby="utm-where">
      <h2 className="utm-h" id="utm-where">Onde colar</h2>
      <ol className="utm-steps">{steps.map((step) => <li key={step}>{step}</li>)}</ol>
    </section>
  );
}

function Params({ link }: { link: UtmLink }) {
  if (!link.params.length) return null;
  return (
    <section className="surface utm-card" aria-labelledby="utm-params">
      <h2 className="utm-h" id="utm-params">Parâmetros</h2>
      <div className="utm-table-wrap">
        <table className="utm-table">
          <thead><tr><th scope="col">Campo</th><th scope="col">Valor</th><th scope="col">Origem</th></tr></thead>
          <tbody>
            {link.params.map((p) => (
              <tr key={`${p.source}-${p.key}`}>
                <th scope="row" className="mono">{p.key}</th>
                <td className="mono">{p.value}</td>
                <td>{SOURCE_LABELS[p.source]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <section className="utm-notes" aria-labelledby="utm-notes">
      <h2 className="utm-notes-title" id="utm-notes">Atenção</h2>
      <ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
    </section>
  );
}

/** UTM view for build_tracking_link: the text to paste, the clean destination, where to paste, the params and notes. */
export function UtmView({ host, state }: { host: Host; state: HostSnapshot }) {
  const link = useMemo(() => summarizeLink(state.payload), [state.payload]);

  useEffect(() => {
    if (link) host.tellModel(`Link com UTMs (${link.platformLabel}) aberto na tela do chat.`);
  }, [host, link]);

  if (!link) return <p className="state" data-tone="error">A resposta não trouxe um link de rastreamento.</p>;
  return (
    <div className="dashboard utm">
      <ViewHeader title="Link com UTMs">
        <span className="utm-platform"><Link2 size={14} aria-hidden />{link.platformLabel}</span>
      </ViewHeader>
      <Paste link={link} />
      <Destination link={link} />
      <Steps steps={link.where} />
      <Params link={link} />
      <Notes notes={link.notes} />
    </div>
  );
}
