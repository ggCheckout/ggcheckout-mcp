import {
  ChevronLeft, ChevronRight, CircleDot, ClipboardList, Clock, CornerDownRight, CreditCard, FileDown, FileText, GitBranch, Image,
  LayoutGrid, ListTree, MapPin, MessageSquare, MousePointerClick, Package, PackageCheck, PenLine, Play, QrCode, Repeat,
  ShoppingBag, Shuffle, Tag, TextCursorInput, Timer, Type, UserPlus, Users, Variable, Video, Volume2, Webhook, Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import '../styles/dashboard.css';
import './telegram.css';
import type { Host, HostSnapshot } from '../host';
import { heightOf, isLabeled, layout, NODE_W } from './layout';
import { modeLabel, summarizeFlow, summarizeFlowList, type Flow, type FlowListItem, type FlowNode } from './model';

/** Below this the labels stop being readable: the canvas scrolls instead. */
const MIN_SCALE = 0.6;

/** nodeRegistry `icon`, per node type. */
const ICONS: Record<string, LucideIcon> = {
  trigger_start: Play, trigger_message: MessageSquare, trigger_callback: MousePointerClick,
  send_text: Type, send_image: Image, send_video: Video, send_document: FileText, send_typing: PenLine, send_audio: Volume2, send_location: MapPin,
  ask_text: TextCursorInput, ask_buttons: LayoutGrid, ask_form: ClipboardList,
  condition: GitBranch, delay: Clock, set_variable: Variable, wait_timeout: Timer, smart_delay: Repeat, switch: ListTree, goto: CornerDownRight, randomizer: Shuffle,
  pix_payment: QrCode, card_payment: CreditCard, show_product: ShoppingBag,
  deliver_product: PackageCheck, deliver_group: Users, deliver_content: FileDown, pack_delivery: Package,
  create_lead: UserPlus, send_webhook: Webhook, tag_user: Tag,
};

function Node({ x, y, node }: { x: number; y: number; node: FlowNode }) {
  const Icon = ICONS[node.type] ?? CircleDot;
  return (
    <div className="tg-node" style={{ left: x, top: y, width: NODE_W, height: heightOf(node), '--node': node.color } as CSSProperties}>
      {node.hasInput && <span className="tg-port tg-port-in" aria-hidden />}
      <div className="tg-node-body">
        <span className="tg-node-icon" aria-hidden><Icon size={17} /></span>
        <span className="tg-node-text">
          <span className="tg-node-label">{node.label}</span>
          {node.preview && <span className="tg-node-preview">{node.preview}</span>}
        </span>
      </div>
      {isLabeled(node) && (
        <div className="tg-handles">
          {node.handles.map((h) => (
            <span key={h.id} className="tg-handle" style={{ '--handle': h.color } as CSSProperties}>{h.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The read-only canvas: the editor's layout, scaled to fit the chat, scrolling when it cannot. */
function FlowCanvas({ flow }: { flow: Flow }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const graph = useMemo(() => layout(flow), [flow]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = width ? Math.max(MIN_SCALE, Math.min(1, width / graph.width)) : 1;
  const colors = [...new Set(flow.nodes.flatMap((n) => n.handles.map((h) => h.color)))];
  const markerId = (color: string) => `tg-arrow-${color.slice(1)}`;

  return (
    <div className="tg-canvas" ref={box}>
      <div style={{ width: graph.width * scale, height: graph.height * scale, margin: '0 auto' }}>
        <div className="tg-plane" style={{ width: graph.width, height: graph.height, transform: `scale(${scale})` }}>
          <svg className="tg-edges" width={graph.width} height={graph.height} aria-hidden>
            <defs>
              {colors.map((c) => (
                <marker key={c} id={markerId(c)} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c} />
                </marker>
              ))}
            </defs>
            {graph.routes.map((r) => (
              <path key={r.id} d={r.d} stroke={r.color} data-side={r.side || undefined} markerEnd={`url(#${markerId(r.color)})`} />
            ))}
          </svg>
          {graph.nodes.map((p) => <Node key={p.node.id} {...p} />)}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ published, unpublished }: { published: boolean; unpublished?: boolean }) {
  return (
    <>
      <span className="tg-badge" data-tone={published ? 'success' : 'muted'}>{published ? 'Publicado' : 'Rascunho'}</span>
      {unpublished && <span className="tg-badge" data-tone="warning">Há mudanças não publicadas</span>}
    </>
  );
}

function FlowDetail({ flow, onBack }: { flow: Flow; onBack?: () => void }) {
  return (
    <div className="tg-detail">
      {onBack && <button type="button" className="tg-back" onClick={onBack}><ChevronLeft size={15} aria-hidden />Voltar</button>}
      <section className="surface tg-card">
        <header className="tg-head">
          <div className="tg-name-row">
            <h2 className="tg-name">{flow.name}</h2>
            <StatusBadge published={flow.published} unpublished={flow.unpublished} />
          </div>
          <p className="card-sub num">{`${modeLabel(flow.mode)} · ${flow.nodes.length} nodes`}</p>
          {flow.unpublished && <p className="tg-hint">Os compradores só veem a versão publicada. Clique em Deploy para publicar esta.</p>}
        </header>
        {flow.nodes.length ? <FlowCanvas flow={flow} /> : <p className="empty">Este flow ainda não tem nodes.</p>}
      </section>
    </div>
  );
}

function FlowList({ flows, canOpen, busyId, onOpen }: {
  flows: FlowListItem[]; canOpen: boolean; busyId: string | null; onOpen: (flow: FlowListItem) => void;
}) {
  return (
    <section className="surface tg-card">
      <header className="tg-list-head">
        <h2 className="card-title">Flows</h2>
        <p className="card-sub">Gerencie os flows de automação deste bot.</p>
      </header>
      {flows.length ? (
        <ul className="tg-rows">
          {flows.map((f) => {
            const body = (
              <>
                <span className="tg-row-icon" aria-hidden><Workflow size={16} /></span>
                <span className="tg-row-main">
                  <span className="tg-name-row"><span className="tg-row-name">{f.name}</span><StatusBadge published={f.published} /></span>
                  <span className="card-sub num">{`${modeLabel(f.mode)} · ${f.nodeCount} nodes`}</span>
                </span>
                {canOpen && <ChevronRight size={16} className="tg-chevron" aria-hidden />}
              </>
            );
            return (
              <li key={f.id} className="tg-row" aria-busy={busyId === f.id || undefined}>
                {canOpen
                  ? <button type="button" className="tg-row-btn" onClick={() => onOpen(f)} aria-label={`Abrir o flow ${f.name}`}>{body}</button>
                  : <div className="tg-row-btn">{body}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="tg-empty">
          <p className="tg-empty-title">Nenhum flow ainda</p>
          <p className="card-sub">Crie seu primeiro flow para este bot.</p>
        </div>
      )}
    </section>
  );
}

/** Telegram flow view: get_telegram_flow as the editor's graph, list_telegram_flows as the flows tab. */
export function TelegramFlowView({ host, state }: { host: Host; state: HostSnapshot }) {
  const flow = useMemo(() => summarizeFlow(state.payload), [state.payload]);
  const flows = useMemo(() => (flow ? null : summarizeFlowList(state.payload)), [flow, state.payload]);
  const [open, setOpen] = useState<Flow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (flow) host.tellModel(`Flow do Telegram "${flow.name}" desenhado na tela do chat (${flow.nodes.length} nodes).`);
    else if (flows) host.tellModel('Lista de flows do Telegram aberta na tela do chat.');
  }, [host, flow, flows]);

  async function openFlow(f: FlowListItem) {
    setBusyId(f.id);
    setFailed(false);
    try {
      const full = summarizeFlow(await host.callTool('get_telegram_flow', { flowId: f.id }));
      if (!full) throw new Error('no flow');
      setOpen(full);
      host.tellModel(`O vendedor abriu o flow "${f.name}" na tela do chat.`);
    } catch {
      setFailed(true);
    } finally {
      setBusyId(null);
    }
  }

  if (!flow && !flows) return <p className="state" data-tone="error">A resposta não trouxe flows do Telegram.</p>;
  return (
    <div className="dashboard telegram">
      {failed && <p className="tg-alert" role="alert">Não foi possível abrir o flow. Tente novamente.</p>}
      {flow && <FlowDetail flow={flow} />}
      {flows && (
        <>
          {open && <FlowDetail key={open.id} flow={open} onBack={() => setOpen(null)} />}
          <div hidden={Boolean(open)}>
            <FlowList flows={flows} canOpen={state.canCallTools} busyId={busyId} onOpen={openFlow} />
          </div>
        </>
      )}
    </div>
  );
}
