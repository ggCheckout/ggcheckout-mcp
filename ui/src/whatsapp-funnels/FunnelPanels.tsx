import { ArrowDown, ArrowUp, Ban, Palette, Plus, Send, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Pills } from '../lib/Pills';
import { SwitchRow } from '../lib/SwitchRow';
import {
  FUNNEL_MAX_COUPON, FUNNEL_MAX_NAME, FUNNEL_MAX_SIGNATURE, FUNNEL_MAX_TEXT, FUNNEL_MAX_WAIT_MINUTES, FUNNEL_MIN_WAIT_MINUTES,
  WAIT_PRESETS, WAIT_UNITS, clipCodePoints, formatTypingRange, manualWaitMinutes, needsSession, stepTiming, waitInUnit,
  type DraftStep, type FunnelDraft, type FunnelVariable, type WaitUnit,
} from './editor';
import { AFTER_EVENT, FUNNEL_TRIGGERS, TRIGGER_LABEL, formatWait, type FunnelTrigger } from './model';

type Patch = (patch: Partial<FunnelDraft>) => void;

/** help.triggers: what starts each kind of funnel. */
const TRIGGER_HELP: Record<FunnelTrigger, string> = {
  abandoned_cart: 'Dispara quando o cliente preenche o checkout e sai sem pagar.',
  pix_unpaid: 'Dispara quando o PIX é gerado e não é pago.',
  pix_expired: 'Dispara quando o PIX vence sem ser pago.',
  card_refused: 'Dispara quando o pagamento no cartão é recusado.',
  card_cancelled: 'Dispara quando o pagamento no cartão é cancelado antes de ser aprovado.',
  manual: 'Não dispara sozinho. O atendente roda numa conversa da caixa de entrada com /funil.',
};

/** The send windows offered: `start-end` in Brasília hours, or `all`. */
const WINDOWS = [['8-21', '8h às 21h'], ['9-18', '9h às 18h'], ['all', 'O dia todo']] as const;

/** PanelHeader: the icon, the title and what the section is for. */
function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="fe-section">
      <header className="fe-section-head">
        <span className="fe-section-icon" aria-hidden>{icon}</span>
        <div>
          <h4 className="fe-section-title">{title}</h4>
          {hint && <p className="ch-hint">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function TextField({ label, value, placeholder, max, upper = false, onChange }: {
  label: string; value: string; placeholder?: string; max: number; upper?: boolean; onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="fe-field">
      <label htmlFor={id} className="ch-label">{label}</label>
      <input id={id} className="ch-input" value={value} placeholder={placeholder} autoComplete="off"
        onChange={(e) => onChange(clipCodePoints(upper ? e.target.value.toUpperCase() : e.target.value, max))} />
    </div>
  );
}

/** Why a manual funnel has no operation to pick: still reading, the read failed, or there is none. */
export function operationsNote(operations: ReadonlyArray<unknown> | null | undefined): string {
  if (operations === undefined) return 'Lendo as suas operações…';
  if (operations === null) return 'Não foi possível ler as suas operações agora. Tente de novo em alguns segundos.';
  return 'Você ainda não tem operação. Conecte um chip por QR e crie uma operação para enviar pelo seu número.';
}

/** FunnelStartPanel: the name, what starts it and who sends. */
export function StartPanel({ draft, operations, onChange }: {
  draft: FunnelDraft; operations: ReadonlyArray<readonly [string, string]> | null | undefined; onChange: Patch;
}) {
  const selectId = useId();
  return (
    <div className="fe-panel-body">
      <TextField label="Nome do funil" value={draft.name} placeholder="Ex.: Carrinho abandonado" max={FUNNEL_MAX_NAME} onChange={(name) => onChange({ name })} />
      <Section icon={<Zap size={15} />} title="Quando começa" hint={TRIGGER_HELP[draft.trigger]}>
        <Pills label="Evento que começa o funil" options={FUNNEL_TRIGGERS.map((t) => [t, TRIGGER_LABEL[t]] as const)} value={draft.trigger}
          onPick={(trigger) => onChange({ trigger })} />
      </Section>
      <Section icon={<Send size={15} />} title="Quem envia" hint="Pelo seu número, numa operação com chip principal e reservas.">
        {!needsSession(draft.trigger) ? (
          <p className="ch-note">As mensagens saem pelos chips da operação de cada produto. Produto sem operação não recebe.</p>
        ) : !operations?.length ? (
          <p className="ch-note">{operationsNote(operations)}</p>
        ) : (
          <div className="fe-field">
            <label htmlFor={selectId} className="ch-label">Operação que envia</label>
            <select id={selectId} className="ch-input fe-select" value={draft.sessionId ?? ''} onChange={(e) => onChange({ sessionId: e.target.value || null })}>
              <option value="" disabled>Escolha uma operação</option>
              {operations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <p className="ch-hint">Se o chip principal cair, a operação passa para o reserva.</p>
          </div>
        )}
      </Section>
    </div>
  );
}

/**
 * FunnelWaitField: the one-click waits and "Outro", which opens a number and a unit. A number the core
 * would refuse says why and leaves the wait as it was; a wait that is not a preset opens in "Outro".
 */
function WaitField({ label, ariaLabel, value, onChange }: { label: string; ariaLabel: string; value: number; onChange: (minutes: number) => void }) {
  const isPreset = WAIT_PRESETS.includes(value);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const [amount, setAmount] = useState(String(waitInUnit(value).amount));
  const [unit, setUnit] = useState<WaitUnit>(waitInUnit(value).unit);
  const custom = customOpen || !isPreset;
  const invalid = custom && manualWaitMinutes(amount, unit) === null;
  const hintId = useId();

  const apply = (nextAmount: string, nextUnit: WaitUnit) => {
    setAmount(nextAmount);
    setUnit(nextUnit);
    const minutes = manualWaitMinutes(nextAmount, nextUnit);
    if (minutes !== null && minutes !== value) onChange(minutes);
  };
  const limits = `de ${formatWait(FUNNEL_MIN_WAIT_MINUTES)} a ${formatWait(FUNNEL_MAX_WAIT_MINUTES)}`;

  return (
    <div className="fe-field">
      <p className="ch-label">{label}</p>
      <Pills label={ariaLabel} options={[...WAIT_PRESETS.map((m) => [String(m), formatWait(m)] as const), ['custom', 'Outro'] as const]}
        value={custom ? 'custom' : String(value)}
        onPick={(key) => {
          if (key !== 'custom') {
            setCustomOpen(false);
            onChange(Number(key));
            return;
          }
          const current = waitInUnit(value);
          setAmount(String(current.amount));
          setUnit(current.unit);
          setCustomOpen(true);
        }} />
      {custom && (
        <div className="fe-wait-custom">
          <input className="ch-input fe-amount" inputMode="numeric" autoComplete="off" aria-label={`${ariaLabel}: tempo`} value={amount}
            aria-invalid={invalid} aria-describedby={hintId} onChange={(e) => apply(e.target.value.replace(/\D/g, '').slice(0, 4), unit)} />
          <select className="ch-input fe-unit" aria-label={`${ariaLabel}: unidade`} value={unit} onChange={(e) => apply(amount, e.target.value as WaitUnit)}>
            {WAIT_UNITS.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </select>
          <p id={hintId} className="fe-wait-hint" data-invalid={invalid || undefined} role={invalid ? 'alert' : undefined}>
            {invalid ? `Use um número inteiro, ${limits}.` : `De ${formatWait(FUNNEL_MIN_WAIT_MINUTES)} a ${formatWait(FUNNEL_MAX_WAIT_MINUTES)}.`}
          </p>
        </div>
      )}
    </div>
  );
}

/** MessageEditor: the variable chips insert `{{key}}` where the cursor is; the text goes as written. */
function MessageEditor({ value, variables, onChange }: { value: string; variables: readonly FunnelVariable[]; onChange: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cursor = useRef(value.length);
  const id = useId();

  const insert = (key: string) => {
    const token = `{{${key}}}`;
    const at = Math.min(cursor.current, value.length);
    const next = clipCodePoints(value.slice(0, at) + token + value.slice(at), FUNNEL_MAX_TEXT);
    onChange(next);
    requestAnimationFrame(() => {
      const end = at + token.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(end, end);
      cursor.current = end;
    });
  };

  return (
    <div className="fe-field">
      <div className="fe-vars" role="group" aria-label="Inserir variável">
        <span className="fe-vars-label">Inserir variável</span>
        {variables.map((v) => (
          <button key={v.key} type="button" className="fe-var" title={v.description} onClick={() => insert(v.key)}>
            <Plus size={12} aria-hidden />{v.label}
          </button>
        ))}
      </div>
      <label htmlFor={id} className="sr-only">Mensagem</label>
      <textarea id={id} ref={ref} className="ch-input fe-text" rows={6} value={value} placeholder="Escreva a mensagem que o cliente vai receber…"
        onChange={(e) => {
          cursor.current = e.target.selectionStart;
          onChange(clipCodePoints(e.target.value, FUNNEL_MAX_TEXT));
        }}
        onSelect={(e) => { cursor.current = e.currentTarget.selectionStart; }} />
      <p className="ch-hint">Use <code>*negrito*</code>, <code>_itálico_</code>, <code>~riscado~</code> e <code>`código`</code> como no WhatsApp.</p>
    </div>
  );
}

/** FunnelStepCard: one message, with its wait, its text and the pace it goes out at. */
export function StepPanel({ step, index, count, trigger, atMinutes, variables, renderedLength, onChange, onRemove, onMove }: {
  step: DraftStep; index: number; count: number; trigger: FunnelTrigger; atMinutes: number; variables: readonly FunnelVariable[];
  renderedLength: number; onChange: (patch: Partial<DraftStep>) => void; onRemove: () => void; onMove: (delta: -1 | 1) => void;
}) {
  const number = index + 1;
  return (
    <div className="fe-panel-body">
      <div className="fe-step-head">
        <p className="fe-step-timing">{stepTiming(step, index, trigger, atMinutes)}</p>
        {count > 1 && (
          <div className="fe-step-tools">
            {/* The message goes with its wait. At an edge the arrow stays focusable and says why (aria-disabled keeps the
                tooltip a disabled button would lose); moveStep leaves the order alone there. */}
            <button type="button" className="fe-icon-btn" onClick={() => onMove(-1)} aria-disabled={index === 0}
              aria-label={`Mover mensagem ${number} para cima`} title={index === 0 ? 'Já é a primeira mensagem' : 'Mover para cima, com a espera'}>
              <ArrowUp size={15} aria-hidden />
            </button>
            <button type="button" className="fe-icon-btn" onClick={() => onMove(1)} aria-disabled={index === count - 1}
              aria-label={`Mover mensagem ${number} para baixo`} title={index === count - 1 ? 'Já é a última mensagem' : 'Mover para baixo, com a espera'}>
              <ArrowDown size={15} aria-hidden />
            </button>
            <button type="button" className="fe-icon-btn fe-icon-danger" onClick={onRemove} aria-label={`Remover mensagem ${number}`} title={`Remover mensagem ${number}`}>
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        )}
      </div>
      <WaitField key={step.key} label={index === 0 ? `Espera depois ${AFTER_EVENT[trigger]}` : 'Espera depois da mensagem anterior'}
        ariaLabel={`Espera da mensagem ${number}`} value={step.waitMinutes} onChange={(waitMinutes) => onChange({ waitMinutes })} />
      <MessageEditor value={step.text} variables={variables} onChange={(text) => onChange({ text })} />
      <div className="fe-field">
        <p className="ch-label">Ritmo do envio</p>
        <div className="fe-sub">
          <SwitchRow label="Marcar como lida antes" checked={step.markSeen} onChange={(markSeen) => onChange({ markSeen })}
            hint="Quando o cliente escreveu, a mensagem dele fica com os tiques azuis antes da resposta." />
          <SwitchRow label="Mostrar “digitando…”" checked={step.showTyping} onChange={(showTyping) => onChange({ showTyping })}
            hint={`Fica ${formatTypingRange(renderedLength)} no topo da conversa, pelo tamanho do texto com as variáveis substituídas.`} />
        </div>
      </div>
    </div>
  );
}

/** FunnelStopPanel: what stops the funnel, the reply switch and the send window. */
export function StopPanel({ draft, onChange }: { draft: FunnelDraft; onChange: Patch }) {
  const window = draft.sendWindow;
  const key = window ? `${window.start}-${window.end}` : 'all';
  // A window saved elsewhere that is none of the offered ones stays on screen, picked.
  const options = WINDOWS.some(([k]) => k === key) || !window ? WINDOWS : [...WINDOWS, [key, `${window.start}h às ${window.end}h`] as const];
  return (
    <div className="fe-panel-body">
      <Section icon={<Ban size={15} />} title="Quando para" hint="O funil para com quem já comprou. Quem pede para sair fica marcado na caixa, e você decide se para.">
        <ul className="fe-stops">
          <li><strong>Comprou</strong> <span>— para na hora, sempre.</span></li>
          <li><strong>Funis parados na caixa</strong> <span>— quando você clica em Parar funil e não enviar mais. Se o cliente mandar “SAIR” ou “PARAR”, a conversa ganha a etiqueta Pediu para sair e nada para sozinho.</span></li>
        </ul>
        <SwitchRow label="Parar quando o cliente responder" checked={draft.stopOnReply} onChange={(stopOnReply) => onChange({ stopOnReply })}
          hint="O funil para e a loja continua a conversa pelo próprio WhatsApp. Desligado, o funil segue e marca a resposta como lida." />
        <div className="fe-field">
          <p className="ch-label">Horário de envio</p>
          <Pills label="Horário de envio" options={options} value={key}
            onPick={(value) => {
              if (value === 'all') return onChange({ sendWindow: null });
              const [start, end] = value.split('-').map(Number);
              onChange({ sendWindow: { start, end } });
            }} />
          <p className="ch-hint">Horário de Brasília. Mensagem que cairia fora do horário espera a próxima abertura; a espera seguinte começa no envio.</p>
        </div>
      </Section>
    </div>
  );
}

/** FunnelStylePanel and FunnelProtectionPanel: the store's signature, coupon and emoji, and the chip's cap. */
export function StylePanel({ draft, onChange }: { draft: FunnelDraft; onChange: Patch }) {
  const style = draft.style;
  return (
    <div className="fe-panel-body">
      <Section icon={<Palette size={15} />} title="Jeito da loja" hint="Vale para todas as mensagens: use {{assinatura}} e {{cupom}} no texto.">
        <div className="fe-grid">
          <TextField label="Assinatura" value={style.signature} placeholder="Ex.: Equipe Fotografia Pro" max={FUNNEL_MAX_SIGNATURE}
            onChange={(signature) => onChange({ style: { ...style, signature } })} />
          <TextField label="Cupom da recuperação" value={style.coupon} placeholder="Ex.: VOLTA10" max={FUNNEL_MAX_COUPON} upper
            onChange={(coupon) => onChange({ style: { ...style, coupon } })} />
        </div>
        <SwitchRow label="Usar emoji" hint="Desligado, os emojis saem das mensagens antes do envio." checked={style.useEmoji}
          onChange={(useEmoji) => onChange({ style: { ...style, useEmoji } })} />
      </Section>
      <Section icon={<ShieldCheck size={15} />} title="Proteção do número" hint="O que derruba número é o comportamento: volume de uma vez, chip novo e texto igual para todos.">
        <p className="ch-note">O teto de conversas novas por dia é de cada chip (de 5 a 200), escolhido ao vincular o chip. Passou do teto, a primeira mensagem do contato espera o dia seguinte.</p>
      </Section>
    </div>
  );
}
