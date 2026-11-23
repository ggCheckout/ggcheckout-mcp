import type { Beat } from './editor';

/**
 * FunnelPhoneSimulation, still: the customer's chat with the whole funnel, each message after its
 * wait, with sample data in place of the variables. Text renders as text, never as markup.
 */
export function FunnelPhone({ beats, problems }: { beats: Beat[]; problems: string[] }) {
  return (
    <div className="fe-phone-wrap">
      <p className="ch-hint">Como o cliente vê</p>
      {problems.length > 0 && <p className="ch-hint">Corrija para ver tudo certo: {problems.join(' ')}</p>}
      <div className="fe-phone" role="log" aria-label="Prévia no celular do cliente">
        <div className="fe-phone-top">
          <span className="fe-phone-avatar" aria-hidden>J</span>
          <span className="fe-phone-who"><strong>João Silva</strong><span>online</span></span>
        </div>
        <div className="fe-phone-chat">
          {beats.map((beat, i) => (beat.kind === 'message'
            ? <p key={i} className="fe-bubble">{beat.text}<span className="fe-bubble-time">{beat.time}</span></p>
            : <p key={i} className="fe-pill">{beat.text}</p>))}
        </div>
      </div>
      <p className="ch-hint">Prévia com dados de exemplo: João Silva · R$ 197,00 · Curso Completo de Fotografia Digital</p>
    </div>
  );
}
