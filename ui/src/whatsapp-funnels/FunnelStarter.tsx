import { FilePlus2, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { BackButton } from '../lib/BackButton';
import { ConfirmPanel } from '../lib/ConfirmPanel';
import '../styles/confirm.css';
import { FUNNEL_MODELS, bornEnabled, funnelVariables, modelSchedule, needsSession, sampleText, type FunnelModel } from './editor';
import { operationsNote } from './FunnelPanels';
import { TRIGGER_LABEL, applyStoreStyle, triggerTakenBy, type FunnelRow } from './model';

const BLANK = 'blank';
const NO_STYLE = { signature: '', coupon: '', useEmoji: true };

/** The model's first message as the preview shows it: sample values in place of the variables. */
const firstMessage = (model: FunnelModel): string => sampleText(applyStoreStyle(model.steps[0]?.text ?? '', NO_STYLE), funnelVariables(model.trigger));

/** Whether the model's trigger already has an enabled funnel (the new one is then born off). */
export function modelTaken(model: FunnelModel, siblings: readonly FunnelRow[] | null): boolean {
  if (!siblings) return false;
  return triggerTakenBy({ id: '', name: model.name, trigger: model.trigger, isEnabled: false, stepCount: model.steps.length, sessionId: null }, siblings) !== null;
}

/** What the confirmation before "Usar modelo" says: the funnel is created, and the cart one starts sending. */
export function modelConfirmation(model: FunnelModel, taken: boolean): { title: string; message: string; confirmLabel: string } {
  return bornEnabled(model.trigger, taken)
    ? {
      title: 'Criar e ligar o funil?',
      message: `O funil ${model.name} é criado e já liga: envia sozinho a partir do próximo ${TRIGGER_LABEL[model.trigger].toLowerCase()}. Ajuste as mensagens no editor depois, ou desligue por lá.`,
      confirmLabel: 'Criar e ligar',
    }
    : {
      title: 'Criar o funil?',
      message: `O funil ${model.name} é criado desligado. Nenhuma mensagem sai até você ligar.`,
      confirmLabel: 'Criar funil',
    };
}

/**
 * FunnelStarterDialog: a ready model to adjust in the editor, or a blank one. Using a model creates
 * the funnel (and turns the cart one on), so it goes through a confirmation first, like turning a
 * funnel on or deleting it; blank opens the editor without writing anything.
 */
export function FunnelStarter({ siblings, operations, busy, error, onUseModel, onBlank, onCancel }: {
  siblings: readonly FunnelRow[] | null;
  /** The seller's operations; a manual model sends by the first. Undefined while reading, null when the read failed. */
  operations: ReadonlyArray<readonly [string, string]> | null | undefined;
  busy: boolean;
  error: string | null;
  onUseModel: (model: FunnelModel) => void;
  onBlank: () => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string>(FUNNEL_MODELS[0].key);
  /** The model waiting for the seller's yes (held, so a click on another card cannot change what is confirmed). */
  const [confirming, setConfirming] = useState<FunnelModel | null>(null);
  const asked = confirming ? modelConfirmation(confirming, modelTaken(confirming, siblings)) : null;
  const model = FUNNEL_MODELS.find((m) => m.key === picked) ?? null;
  const blocked = Boolean(model && needsSession(model.trigger) && !operations?.length);
  const born = model ? (bornEnabled(model.trigger, modelTaken(model, siblings)) ? 'Nasce ligado: dispara no próximo carrinho abandonado.' : 'Nasce desligado. Ligue quando quiser começar a enviar.') : null;

  return (
    <div className="ch-detail">
      <BackButton onBack={onCancel} label="Voltar aos funis" />
      <section className="surface ch-card">
        <header className="ch-list-head">
          <h2 className="card-title">Como começar o funil?</h2>
          <p className="card-sub">Escolha um modelo pronto e ajuste no editor, ou comece em branco. Os automáticos saem pela operação de cada produto.</p>
        </header>
        <div className="fe-models" role="group" aria-label="Modelos de funil">
          {FUNNEL_MODELS.map((m, i) => {
            const taken = modelTaken(m, siblings);
            return (
              <button key={m.key} type="button" className="fe-model" aria-pressed={picked === m.key} disabled={confirming !== null} onClick={() => setPicked(m.key)}>
                <span className="fe-model-head">
                  <span className="ch-icon" aria-hidden><MessageCircle size={16} /></span>
                  <span className="fe-model-name">{m.name}</span>
                  {i === 0 && <span className="ch-tag fe-tag-blue">Recomendado</span>}
                  {taken && <span className="ch-tag">Nasce desligado</span>}
                </span>
                <span className="ch-hint">{TRIGGER_LABEL[m.trigger]} · {modelSchedule(m)}</span>
                <span className="fe-model-label">Primeira mensagem</span>
                <span className="fe-model-text">{firstMessage(m)}</span>
                {taken && <span className="ch-hint">Já existe um funil ligado para {TRIGGER_LABEL[m.trigger]}; este nasce desligado.</span>}
              </button>
            );
          })}
          <button type="button" className="fe-model" aria-pressed={picked === BLANK} disabled={confirming !== null} onClick={() => setPicked(BLANK)}>
            <span className="fe-model-head">
              <span className="ch-icon" aria-hidden><FilePlus2 size={16} /></span>
              <span className="fe-model-name">Em branco</span>
            </span>
            <span className="ch-hint">Escrever do zero. Abre o editor sem gravar nada.</span>
          </button>
        </div>
        {blocked && <p className="ch-note" data-tone="warning">O funil à mão envia por uma operação. {operationsNote(operations)}</p>}
        {model && !blocked && <p className="ch-hint">{born}</p>}
        {error && <p className="ch-alert" role="alert">{error}</p>}
        {confirming && asked ? (
          <ConfirmPanel label={asked.title} title={asked.title} message={asked.message} confirmLabel={asked.confirmLabel}
            busyLabel="Criando…" busy={busy}
            onConfirm={() => {
              setConfirming(null);
              onUseModel(confirming);
            }}
            onCancel={() => setConfirming(null)} />
        ) : (
          <div className="confirm-actions">
            <button type="button" className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancelar</button>
            <button type="button" className="cta" disabled={busy || blocked} onClick={() => (model ? setConfirming(model) : onBlank())}>
              {busy ? 'Criando…' : model ? 'Usar modelo' : 'Começar em branco'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
