import { AlertTriangle, Clock, Flag, MessageCircle, Plus, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FUNNEL_MAX_STEPS, PALETTE, canAddStep, excerpt, stopDetail, type DraftStep, type FlowSelection, type FunnelDraft, type StepBuilder } from './editor';
import { AFTER_EVENT, TRIGGER_LABEL, formatWait } from './model';

type Kind = 'start' | 'wait' | 'message' | 'end';
const KIND: Record<Kind, { label: string; Icon: typeof Zap }> = {
  start: { label: 'Começa', Icon: Zap },
  wait: { label: 'Espera', Icon: Clock },
  message: { label: 'WhatsApp', Icon: MessageCircle },
  end: { label: 'Fim', Icon: Flag },
};

/** FunnelFlowNode: the kind, the title, one line of detail and the pace badges; the whole block opens its properties. */
function Block({ kind, title, detail, badges = [], warn = false, selected, onSelect }: {
  kind: Kind; title: string; detail: string; badges?: string[]; warn?: boolean; selected: boolean; onSelect: () => void;
}) {
  const { label, Icon } = KIND[kind];
  return (
    <button type="button" className="fe-block" data-kind={kind} aria-pressed={selected} onClick={onSelect}>
      <span className="fe-block-row">
        <span className="fe-block-icon" aria-hidden><Icon size={15} /></span>
        <span className="fe-block-main">
          <span className="fe-block-kind">{label}</span>
          <span className="fe-block-title">{title}</span>
        </span>
        {warn && <AlertTriangle size={15} className="fe-warn" aria-label="Falta preencher" />}
      </span>
      <span className="fe-block-detail" data-warn={warn || undefined}>{detail}</span>
      {badges.length > 0 && <span className="fe-badges">{badges.map((b) => <span key={b} className="ch-tag">{b}</span>)}</span>}
    </button>
  );
}

/** The palette of what goes into the funnel; `onPick` builds the step. */
function Palette({ onPick, onClose }: { onPick: (build: StepBuilder) => void; onClose: () => void }) {
  return (
    <div className="fe-palette" role="menu" aria-label="Componentes do funil" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      {PALETTE.map((item) => (
        <button key={item.id} type="button" role="menuitem" className="fe-palette-item" onClick={() => onPick(item.build)}>
          <span className="fe-palette-label">{item.label}</span>
          <span className="ch-hint">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}

/** FunnelFlowInsertEdge: the line between two blocks, with the "+" where a whole step can come in. */
function Edge({ insertAt, after, full, open, onToggle, onPick }: {
  insertAt?: number; after?: string; full: boolean; open: boolean; onToggle: () => void; onPick: (build: StepBuilder) => void;
}) {
  if (insertAt === undefined) return <span className="fe-edge" aria-hidden />;
  return (
    <div className="fe-edge fe-edge-insert">
      <button type="button" className="fe-plus" aria-expanded={open} disabled={full} onClick={onToggle}
        aria-label={`Adicionar bloco depois de ${after}`} title={full ? `Até ${FUNNEL_MAX_STEPS} mensagens por funil` : 'Entra aqui, com a espera antes da mensagem'}>
        <Plus size={14} aria-hidden />
      </button>
      {open && <Palette onPick={onPick} onClose={onToggle} />}
    </div>
  );
}

/**
 * FunnelFlowCanvas, as a column: Começa → (Espera → WhatsApp) per message → Fim. The dashboard's board
 * also lets the blocks be dragged; the widget keeps their order and the positions saved there.
 */
export function FunnelFlow({ draft, selection, onSelect, onAdd, toolbar }: {
  draft: FunnelDraft; selection: FlowSelection; onSelect: (selection: FlowSelection) => void;
  onAdd: (index: number, build: StepBuilder) => void; toolbar: ReactNode;
}) {
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const full = !canAddStep(draft.steps);
  const isStep = (step: DraftStep) => selection.kind === 'step' && selection.key === step.key;
  const add = (index: number) => (build: StepBuilder) => {
    setMenuAt(null);
    onAdd(index, build);
  };
  const edge = (index: number, after: string) => (
    <Edge insertAt={index} after={after} full={full} open={menuAt === index} onToggle={() => setMenuAt(menuAt === index ? null : index)} onPick={add(index)} />
  );

  return (
    <section className="fe-flow" aria-label="Fluxo do funil">
      <div className="fe-toolbar">
        <div className="fe-add">
          <button type="button" className="ch-ghost" aria-expanded={menuAt === -1} disabled={full} onClick={() => setMenuAt(menuAt === -1 ? null : -1)}
            title={full ? `Limite de ${FUNNEL_MAX_STEPS} mensagens` : undefined}>
            <Plus size={14} aria-hidden />Adicionar
          </button>
          {menuAt === -1 && <Palette onPick={add(draft.steps.length)} onClose={() => setMenuAt(null)} />}
        </div>
        {toolbar}
      </div>
      <p className="ch-hint">Toque num bloco para editar.</p>
      <div className="fe-column">
        <Block kind="start" title={TRIGGER_LABEL[draft.trigger]} detail={draft.name.trim() || 'Pelo seu número'}
          selected={selection.kind === 'start'} onSelect={() => onSelect({ kind: 'start' })} />
        {draft.steps.map((step, i) => {
          const empty = !step.text.trim();
          const badges = [step.markSeen && 'Visto', step.showTyping && 'Digitando…'].filter((b): b is string => Boolean(b));
          return (
            <div key={step.key} className="fe-step-blocks">
              {edge(i, i === 0 ? 'Começa' : `Mensagem ${i}`)}
              <Block kind="wait" title={`Esperar ${formatWait(step.waitMinutes)}`} detail={i === 0 ? `Depois ${AFTER_EVENT[draft.trigger]}` : `Depois da mensagem ${i}`}
                selected={isStep(step)} onSelect={() => onSelect({ kind: 'step', key: step.key })} />
              <span className="fe-edge" aria-hidden />
              <Block kind="message" title={`Mensagem ${i + 1}`} detail={empty ? 'Escreva a mensagem' : excerpt(step.text)} warn={empty} badges={badges}
                selected={isStep(step)} onSelect={() => onSelect({ kind: 'step', key: step.key })} />
            </div>
          );
        })}
        {edge(draft.steps.length, draft.steps.length ? `Mensagem ${draft.steps.length}` : 'Começa')}
        <Block kind="end" title="Fim do funil" detail={stopDetail(draft.stopOnReply)} selected={selection.kind === 'end'} onSelect={() => onSelect({ kind: 'end' })} />
      </div>
    </section>
  );
}
