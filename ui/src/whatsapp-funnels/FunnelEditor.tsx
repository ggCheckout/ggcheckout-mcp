import { Palette, Trash2, Workflow } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { Host } from '../host';
import { BackButton } from '../lib/BackButton';
import { ConfirmPanel } from '../lib/ConfirmPanel';
import { messageOf } from '../lib/messageOf';
import { Pills } from '../lib/Pills';
import { SwitchRow } from '../lib/SwitchRow';
import {
  bornEnabled, buildBeats, cumulativeMinutes, draftFrom, funnelProblems, funnelVariables, insertStep, moveStep, sampleText, saveBlocked, shiftLayout,
  snapshotOf, toInput, unchangedSince, type DraftStep, type FlowSelection, type FunnelDraft, type StepBuilder,
} from './editor';
import { ENABLE_FAILED, createFunnel } from './createFunnel';
import { FunnelFlow } from './FunnelFlow';
import { StartPanel, StepPanel, StopPanel, StylePanel } from './FunnelPanels';
import { FunnelPhone } from './FunnelPhone';
import { TRIGGER_LABEL, applyStoreStyle, summarizeFunnel, toggleWords, triggerTakenBy, type FunnelDetail, type FunnelRow } from './model';

type Confirming = 'save' | 'toggle' | 'delete' | 'leave' | null;

/** What a draft not yet created looks like as a row, to ask whether its trigger is taken. */
const rowOf = (draft: FunnelDraft, base: FunnelDetail | null): FunnelRow => ({
  id: base?.id ?? '', name: draft.name, trigger: draft.trigger, isEnabled: base?.isEnabled ?? false, stepCount: draft.steps.length, sessionId: draft.sessionId,
});

const firstSelection = (draft: FunnelDraft): FlowSelection => (draft.steps[0] ? { kind: 'step', key: draft.steps[0].key } : { kind: 'start' });

/**
 * FunnelEditor: the funnel as a flow of blocks; a block opens its properties, and Prévia plays the
 * funnel on the customer's phone. Editing is a local draft until Salvar, which replaces the funnel
 * whole, so it re-reads it first and refuses when it changed since it was shown. The on/off writes
 * at once, but only with the draft saved: the core checks what is stored, not what is on screen.
 */
export type EditorStart = { kind: 'stored'; funnel: FunnelDetail } | { kind: 'new'; draft: FunnelDraft };

export function FunnelEditor({ host, start, operations, siblings, canCallTools, onBack, onSaved, onDeleted }: {
  host: Host;
  /** A stored funnel, or the draft of one not created yet ("Criar funil" creates it). */
  start: EditorStart;
  /** The seller's operations as [id, name]; undefined while reading, null when the read failed. */
  operations: ReadonlyArray<readonly [string, string]> | null | undefined;
  siblings: readonly FunnelRow[] | null;
  canCallTools: boolean;
  onBack?: () => void;
  /** Created, saved or turned on/off: the list shows it as it is now. */
  onSaved?: (funnel: FunnelDetail) => void;
  onDeleted?: (id: string) => void;
}) {
  const [base, setBase] = useState<FunnelDetail | null>(start.kind === 'stored' ? start.funnel : null);
  const [draft, setDraft] = useState<FunnelDraft>(() => (start.kind === 'stored' ? draftFrom(start.funnel) : start.draft));
  /** What was last stored (or, for a new funnel, what it opened with): a different draft has something to lose. */
  const [saved, setSaved] = useState<string>(() => snapshotOf(start.kind === 'stored' ? draftFrom(start.funnel) : start.draft));
  const [selection, setSelection] = useState<FlowSelection>(() => firstSelection(draft));
  const [tab, setTab] = useState<'props' | 'preview'>('props');
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState<'save' | 'toggle' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drift, setDrift] = useState<FunnelDetail | null>(null);
  const [tried, setTried] = useState(false);
  const [savedThisVisit, setSavedThisVisit] = useState(false);
  const [isDeleted, setDeleted] = useState(false);
  const [nextKey, setNextKey] = useState(draft.steps.length + 1);

  const isNew = base === null;
  const isEnabled = base?.isEnabled ?? false;
  const changed = snapshotOf(draft) !== saved;
  const dirty = isNew || changed;
  const problems = funnelProblems(draft);
  const blocked = saveBlocked(draft);
  const variables = useMemo(() => funnelVariables(draft.trigger), [draft.trigger]);
  const render = useCallback((text: string) => sampleText(applyStoreStyle(text, draft.style), variables), [draft.style, variables]);
  const beats = useMemo(() => buildBeats(draft, render), [draft, render]);
  const at = cumulativeMinutes(draft.steps);
  const taken = siblings ? triggerTakenBy(rowOf(draft, base), siblings) : null;
  const isManual = draft.trigger === 'manual';

  const patch = (next: Partial<FunnelDraft>) => setDraft((d) => ({ ...d, ...next }));
  const patchStep = (key: string, next: Partial<DraftStep>) => setDraft((d) => ({ ...d, steps: d.steps.map((s) => (s.key === key ? { ...s, ...next } : s)) }));

  const removeStep = (key: string) => {
    setDraft((d) => {
      const index = d.steps.findIndex((s) => s.key === key);
      return index < 0 ? d : { ...d, steps: d.steps.filter((s) => s.key !== key), layout: shiftLayout(d.layout, index, -1) };
    });
    setSelection({ kind: 'end' });
  };

  /** The message trades places with its neighbor, its wait with it; the panel stays on it. */
  const move = (key: string, delta: -1 | 1) => setDraft((d) => ({ ...d, steps: moveStep(d.steps, d.steps.findIndex((s) => s.key === key), delta) }));

  const addStep = (index: number, build: StepBuilder) => {
    const step = build(`step_new_${nextKey}`);
    setNextKey((n) => n + 1);
    setDraft((d) => ({ ...d, steps: insertStep(d.steps, index, step), layout: shiftLayout(d.layout, index, 1) }));
    setSelection({ kind: 'step', key: step.key });
    setTab('props');
  };

  /** The stored funnel replaces the draft: after a refusal by drift, or to start over from it. */
  const reload = (fresh: FunnelDetail) => {
    // New keys: a field kept by its step's key (the wait's "Outro") must not keep the discarded draft.
    const loaded = draftFrom(fresh);
    const next = { ...loaded, steps: loaded.steps.map((s, i) => ({ ...s, key: `step_reload_${nextKey + i}` })) };
    setNextKey((n) => n + loaded.steps.length);
    setBase(fresh);
    setDraft(next);
    setSaved(snapshotOf(next));
    setSelection(firstSelection(next));
    setDrift(null);
    onSaved?.(fresh);
  };

  async function readFunnel(id: string): Promise<FunnelDetail> {
    const fresh = summarizeFunnel(await host.callTool('get_whatsapp_funnel', { funnelId: id }));
    if (!fresh) throw new Error('no funnel');
    return fresh;
  }

  async function save() {
    setBusy('save');
    setError(null);
    const input = toInput(draft);
    const sent = snapshotOf(draft);
    let wrote = false;
    try {
      if (base) {
        const fresh = await readFunnel(base.id);
        if (!unchangedSince(base, fresh)) {
          setDrift(fresh);
          return;
        }
        const answer = summarizeFunnel(await host.callTool('update_whatsapp_funnel', { funnelId: base.id, ...input }));
        wrote = true;
        const next = answer ?? await readFunnel(base.id);
        setBase(next);
        onSaved?.(next);
        host.tellModel(`Na tela do chat, o funil ${input.name} foi salvo com ${input.steps.length} mensagem(ns).`);
      } else {
        const { funnel: created, enableFailed } = await createFunnel(host, input, Boolean(taken));
        if (enableFailed) setError(ENABLE_FAILED);
        setBase(created);
        onSaved?.(created);
        host.tellModel(`Na tela do chat, o funil ${input.name} foi criado${created.isEnabled ? ' e ligado' : ', desligado'}.`);
      }
      setSaved(sent);
      setSavedThisVisit(true);
      setTried(false);
    } catch {
      setError(wrote ? 'O funil foi salvo, mas não foi possível ler a versão gravada. Abra o funil de novo para conferir.'
        : base ? 'Não foi possível salvar o funil. Tente de novo em alguns segundos.' : 'Não foi possível criar o funil. Tente de novo em alguns segundos.');
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function toggle() {
    if (!base) return;
    const enabled = !base.isEnabled;
    setBusy('toggle');
    setError(null);
    try {
      const next = summarizeFunnel(await host.callTool('toggle_whatsapp_funnel', { funnelId: base.id, enabled })) ?? { ...base, isEnabled: enabled };
      setBase(next);
      onSaved?.(next);
      host.tellModel(`Na tela do chat, o funil ${base.name} foi ${enabled ? 'ligado' : 'desligado'}.`);
    } catch (e) {
      // ApiError says "API Error (409): …" when another funnel already holds the trigger.
      setError(/\(409\)/.test(messageOf(e))
        ? `Já há outro funil ligado para ${TRIGGER_LABEL[base.trigger]}. Desligue aquele primeiro.`
        : 'Não foi possível mudar o funil. Tente de novo em alguns segundos.');
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function remove() {
    if (!base) return;
    setBusy('delete');
    setError(null);
    try {
      await host.callTool('delete_whatsapp_funnel', { funnelId: base.id });
      host.tellModel(`Na tela do chat, o funil ${base.name} foi excluído.`);
      setDeleted(true);
      onDeleted?.(base.id);
    } catch {
      setError('Não foi possível excluir o funil. Tente de novo em alguns segundos.');
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  if (isDeleted) {
    return (
      <section className="surface ch-card">
        {onBack && <BackButton onBack={onBack} label="Voltar aos funis" />}
        <p className="ch-note">Funil {base?.name} excluído.</p>
      </section>
    );
  }

  const back = onBack && (() => (changed ? setConfirming('leave') : onBack()));
  const status = busy === 'save' ? 'Salvando…' : isNew ? 'Funil novo, ainda não salvo.' : dirty ? 'Alterações não salvas.' : savedThisVisit ? 'Tudo salvo.' : null;
  const toggleHint = isNew ? 'Crie o funil para poder ligar.'
    : dirty ? 'Salve as alterações para ligar ou desligar.'
      : isEnabled && problems.length ? 'Envio pausado: corrija os problemas.'
        : isEnabled ? (isManual ? 'Pode ser rodado pela caixa de entrada.' : 'Enviando para novos eventos.')
          : taken ? `${taken.name} já está ligado para ${TRIGGER_LABEL[draft.trigger]}.`
            : 'Nenhuma mensagem sai.';
  const toggleMessage = isEnabled
    ? (isManual ? 'O funil sai da lista da caixa de entrada. Quem já está nele para de receber as próximas mensagens.'
      : 'Quem estava no funil para de receber mensagens, e o evento deixa de abrir o funil.')
    : (isManual ? 'O funil passa a aparecer na caixa de entrada, para rodar numa conversa.'
      : `O funil começa a enviar sozinho no próximo evento: ${TRIGGER_LABEL[draft.trigger].toLowerCase()}.`);
  const saveMessage = isNew
    ? (bornEnabled(draft.trigger, Boolean(taken)) ? 'O funil é criado e já liga: dispara no próximo carrinho abandonado.' : 'O funil é criado desligado. Ligue quando quiser começar a enviar.')
    : `O funil é gravado como está na tela.${isEnabled ? ' Ele está ligado: as próximas mensagens já saem assim.' : ''}`;

  const inspector = (() => {
    if (selection.kind === 'start') return { title: 'Quando começa', body: <StartPanel draft={draft} operations={operations} onChange={patch} /> };
    if (selection.kind === 'end') return { title: 'Quando para', body: <StopPanel draft={draft} onChange={patch} /> };
    if (selection.kind === 'step') {
      const index = draft.steps.findIndex((s) => s.key === selection.key);
      const step = draft.steps[index];
      if (step) {
        return {
          title: `Mensagem ${index + 1}`,
          body: (
            <StepPanel step={step} index={index} count={draft.steps.length} trigger={draft.trigger} atMinutes={at[index]} variables={variables}
              renderedLength={render(step.text).length} onChange={(next) => patchStep(step.key, next)} onRemove={() => removeStep(step.key)}
              onMove={(delta) => move(step.key, delta)} />
          ),
        };
      }
    }
    return { title: 'Jeito da loja e proteção', body: <StylePanel draft={draft} onChange={patch} /> };
  })();

  return (
    <div className="ch-detail">
      {back && <BackButton onBack={back} label="Voltar aos funis" />}
      <section className="surface ch-card fe-card">
        <header className="ch-head">
          <span className="ch-icon big" aria-hidden><Workflow size={20} /></span>
          <div className="ch-head-main">
            <h2 className="ch-name">{draft.name.trim() || 'Funil sem nome'}</h2>
            <p className="ch-sub"><span>{TRIGGER_LABEL[draft.trigger]}</span><span role="status" aria-live="polite">{status}</span></p>
          </div>
          {canCallTools && (
            <div className="fe-actions">
              {!isNew && (
                <div className="fe-toggle">
                  <SwitchRow label={isManual ? 'Disponível na caixa' : 'Funil ligado'} hint={toggleHint} checked={isEnabled}
                    disabled={dirty || busy !== null || confirming !== null || (!isEnabled && Boolean(taken))}
                    onChange={(on) => (on && problems.length ? setTried(true) : setConfirming('toggle'))} />
                </div>
              )}
              <button type="button" className="cta compact" onClick={() => (blocked ? setTried(true) : setConfirming('save'))} disabled={busy !== null || confirming !== null}>
                {busy === 'save' ? 'Salvando…' : isNew ? 'Criar funil' : 'Salvar'}
              </button>
              {!isNew && (
                <button type="button" className="ch-ghost wf-danger" onClick={() => setConfirming('delete')} disabled={busy !== null || confirming !== null}>
                  <Trash2 size={14} aria-hidden />Excluir
                </button>
              )}
            </div>
          )}
        </header>

        {confirming === 'save' && (
          <ConfirmPanel label={isNew ? 'Criar funil' : 'Salvar funil'} title={isNew ? 'Criar funil?' : 'Salvar funil?'} message={saveMessage}
            confirmLabel={isNew ? 'Criar funil' : 'Salvar'} busyLabel={isNew ? 'Criando…' : 'Salvando…'} busy={busy === 'save'} onConfirm={save} onCancel={() => setConfirming(null)} />
        )}
        {confirming === 'toggle' && (
          <ConfirmPanel label={isEnabled ? 'Desligar funil' : 'Ligar funil'} tone={isEnabled ? 'warning' : undefined} message={toggleMessage}
            confirmLabel={toggleWords(rowOf(draft, base)).action}
            busyLabel="Salvando…" busy={busy === 'toggle'} onConfirm={toggle} onCancel={() => setConfirming(null)} />
        )}
        {confirming === 'delete' && (
          <ConfirmPanel label="Excluir funil?" tone="warning" title="Excluir funil?"
            message="Os clientes que estão no funil param de receber as próximas mensagens. Não dá para desfazer."
            confirmLabel="Excluir funil" busyLabel="Excluindo…" busy={busy === 'delete'} onConfirm={remove} onCancel={() => setConfirming(null)} />
        )}
        {confirming === 'leave' && onBack && (
          <ConfirmPanel label="Sair sem salvar?" tone="warning" title="Sair sem salvar?" message="As alterações deste funil que não foram salvas se perdem."
            confirmLabel="Sair sem salvar" busyLabel="Saindo…" busy={false} onConfirm={onBack} onCancel={() => setConfirming(null)} />
        )}
        {drift && (
          <div className="ch-alert fe-drift" role="alert">
            <p>Este funil mudou desde que foi aberto (no painel, no chat ou em outro card). Nada foi gravado, para não desfazer aquela mudança.</p>
            <button type="button" className="ch-ghost" onClick={() => reload(drift)}>Recarregar e descartar as alterações daqui</button>
          </div>
        )}
        {error && <p className="ch-alert" role="alert">{error}</p>}
        {(tried || isEnabled) && problems.length > 0 && (
          <div className="ch-note fe-problems" data-tone="warning" role="alert">
            <p className="fe-problems-title">{isEnabled ? 'Envio pausado. Corrija para continuar:' : blocked ? 'Ainda não dá para salvar:' : 'Ainda não dá para ligar:'}</p>
            <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}

        <div className="fe-layout">
          <FunnelFlow draft={draft} selection={selection} onSelect={(next) => { setSelection(next); setTab('props'); }} onAdd={addStep}
            toolbar={(
              <button type="button" className="ch-ghost" aria-pressed={selection.kind === 'settings'} onClick={() => { setSelection({ kind: 'settings' }); setTab('props'); }}>
                <Palette size={14} aria-hidden />Jeito da loja e proteção
              </button>
            )} />
          <section className="fe-panel" aria-label="Painel do fluxo">
            <Pills label="Painel do fluxo" options={[['props', 'Propriedades'], ['preview', 'Prévia']] as const} value={tab} onPick={setTab} />
            {tab === 'props'
              ? <><h3 className="ch-panel-title">{inspector.title}</h3>{inspector.body}</>
              : <FunnelPhone beats={beats} problems={problems} />}
          </section>
        </div>
      </section>
    </div>
  );
}
