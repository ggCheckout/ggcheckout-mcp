// Turns the Telegram flow tools into what the flow view draws, following the bot's flow editor
// (saas components/telegram/flow-editor: nodeRegistry, getNodePreview, HANDLE_LABEL_CONFIG):
// get_telegram_flow is one flow's graph, laid out where the editor keeps each node, and
// list_telegram_flows the bot's flows. Pure.

import { type Payload, count, isPayload, text } from '../lib/payload';

export type Category = 'triggers' | 'messages' | 'inputs' | 'logic' | 'commerce' | 'delivery' | 'actions';

/** nodeRegistry: the editor's label, category and the handles it draws below the node. */
const NODES: Record<string, { label: string; category: Category; outputs: string[] }> = {
  trigger_start: { label: 'Comando /start', category: 'triggers', outputs: ['default'] },
  trigger_message: { label: 'Mensagem Recebida', category: 'triggers', outputs: ['default'] },
  trigger_callback: { label: 'Clique em Botão', category: 'triggers', outputs: ['default'] },
  send_text: { label: 'Enviar Texto', category: 'messages', outputs: ['default'] },
  send_image: { label: 'Enviar Imagem', category: 'messages', outputs: ['default'] },
  send_video: { label: 'Enviar Vídeo', category: 'messages', outputs: ['default'] },
  send_document: { label: 'Enviar Documento', category: 'messages', outputs: ['default'] },
  send_typing: { label: 'Digitando...', category: 'messages', outputs: ['default'] },
  send_audio: { label: 'Enviar Áudio', category: 'messages', outputs: ['default'] },
  send_location: { label: 'Enviar Localização', category: 'messages', outputs: ['default'] },
  ask_text: { label: 'Perguntar Texto', category: 'inputs', outputs: ['default'] },
  ask_buttons: { label: 'Perguntar com Botões', category: 'inputs', outputs: [] },
  ask_form: { label: 'Formulário', category: 'inputs', outputs: ['default'] },
  condition: { label: 'Condição', category: 'logic', outputs: ['true', 'false'] },
  delay: { label: 'Atraso', category: 'logic', outputs: ['default'] },
  set_variable: { label: 'Definir Variável', category: 'logic', outputs: ['default'] },
  wait_timeout: { label: 'Aguardar Resposta', category: 'logic', outputs: ['responded', 'timeout'] },
  smart_delay: { label: 'Remarketing', category: 'logic', outputs: ['next', 'expired'] },
  switch: { label: 'Switch', category: 'logic', outputs: [] },
  goto: { label: 'Go To', category: 'logic', outputs: [] },
  randomizer: { label: 'Randomizer', category: 'logic', outputs: [] },
  pix_payment: { label: 'Pagamento PIX', category: 'commerce', outputs: ['approved', 'expired'] },
  card_payment: { label: 'Pagamento Cartão', category: 'commerce', outputs: ['approved', 'expired'] },
  show_product: { label: 'Exibir Produto', category: 'commerce', outputs: ['default'] },
  deliver_product: { label: 'Entregar Produto', category: 'delivery', outputs: ['default'] },
  deliver_group: { label: 'Acesso a Grupo', category: 'delivery', outputs: ['default'] },
  deliver_content: { label: 'Enviar Conteúdo', category: 'delivery', outputs: ['default'] },
  pack_delivery: { label: 'Entrega por Produto', category: 'delivery', outputs: ['default'] },
  create_lead: { label: 'Criar Lead', category: 'actions', outputs: ['default'] },
  send_webhook: { label: 'Webhook', category: 'actions', outputs: ['default'] },
  tag_user: { label: 'Tag Usuário', category: 'actions', outputs: ['default'] },
};

/** The editor's category colors (nodeRegistry `color`). */
export const CATEGORY_COLORS: Record<Category, string> = {
  triggers: '#22c55e', messages: '#0e51f2', inputs: '#a855f7', logic: '#f59e0b', commerce: '#06b6d4', delivery: '#10b981', actions: '#ec4899',
};

/** HANDLE_LABEL_CONFIG with the flowNode.handleLabels copy; a default handle has no label. */
const HANDLES: Record<string, { label: string; color: string }> = {
  true: { label: 'Sim', color: '#22c55e' },
  false: { label: 'Não', color: '#ef4444' },
  responded: { label: 'Respondeu', color: '#22c55e' },
  next: { label: 'Respondeu', color: '#22c55e' },
  timeout: { label: 'Timeout', color: '#ef4444' },
  expired: { label: 'Expirou', color: '#ef4444' },
  approved: { label: 'Aprovado', color: '#22c55e' },
};
const DEFAULT_HANDLE_COLOR = '#94a3b8';

export interface Handle {
  id: string;
  /** Empty for the single unlabeled output. */
  label: string;
  color: string;
}

export interface FlowNode {
  id: string;
  type: string;
  label: string;
  category: Category | null;
  color: string;
  preview: string;
  x: number;
  y: number;
  /** Trigger nodes have no input. */
  hasInput: boolean;
  handles: Handle[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  handle: string;
}

export interface Flow {
  id: string;
  name: string;
  mode: 'basic' | 'visual';
  published: boolean;
  unpublished: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Text equivalent of the drawn graph: one "Origem → Destino (rótulo)" line per edge between known nodes. */
export function describeConnections(flow: Flow): string[] {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  return flow.edges.flatMap((e) => {
    const from = byId.get(e.source);
    const to = byId.get(e.target);
    if (!from || !to) return [];
    const label = from.handles.find((h) => h.id === e.handle)?.label;
    return [`${from.label} → ${to.label}${label ? ` (${label})` : ''}`];
  });
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const cut = (s: string, n: number) => {
  const chars = Array.from(s);
  return chars.length > n ? `${chars.slice(0, n).join('').trimEnd()}…` : s;
};

/** A delay in the way people say it: "45s", "15 min", "1 h". */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600 || seconds % 3600 !== 0) return `${Math.round(seconds / 60)} min`;
  return `${seconds / 3600} h`;
}

/** getNodePreview: the line under the node's label. */
export function nodePreview(type: string, d: Payload): string {
  switch (type) {
    case 'trigger_start': return text(d.command) ?? '/start';
    case 'trigger_message': return d.matchType === 'any' || !text(d.pattern) ? 'Qualquer mensagem' : String(d.pattern);
    case 'trigger_callback': return text(d.callbackData) ?? '';
    case 'send_text': return text(d.text) ? cut(stripHtml(d.text), 60) : 'Texto vazio';
    case 'send_image': return text(d.caption) ?? 'Imagem';
    case 'send_video': return text(d.caption) ?? 'Vídeo';
    case 'send_document': return text(d.caption) ?? 'Documento';
    case 'send_audio': return text(d.caption) ?? 'Áudio';
    case 'send_location': return 'Localização no mapa';
    case 'send_typing': return formatSeconds(count(d.duration) || 2);
    case 'ask_text': return text(d.prompt) ? cut(d.prompt, 60) : text(d.variableName) ?? '';
    case 'ask_buttons': return text(d.prompt) ? cut(d.prompt, 60) : '';
    case 'ask_form': return Array.isArray(d.fields) ? d.fields.map((f: Payload) => f?.label).filter(Boolean).join(', ') : '';
    case 'condition': return text(d.variable) ? `${d.variable} ${d.operator ?? ''} ${d.value ?? ''}`.trim() : 'Configurar condição';
    case 'delay': return formatSeconds(count(d.seconds));
    case 'set_variable': return text(d.variableName) ? `${d.variableName} = ${d.value ?? ''}` : '';
    case 'wait_timeout': return `Timeout: ${count(d.timeoutMinutes) || 5} min`;
    case 'smart_delay': return text(d.message) ? cut(d.message, 40) : `${count(d.intervalMinutes) || 60}min × ${count(d.maxRetries) || 3} tentativas`;
    case 'switch': return text(d.variable) ? `${d.variable} (${Array.isArray(d.cases) ? d.cases.length : 0} cases)` : 'Configurar switch';
    case 'goto': return text(d.targetNodeId) ? 'Redirecionamento configurado' : 'Selecionar bloco';
    case 'randomizer': return Array.isArray(d.paths) ? d.paths.map((p: Payload) => `${p?.label || '?'}: ${p?.weight}%`).join(', ') : '';
    case 'pix_payment':
    case 'card_payment': {
      const id = text(d.checkoutId);
      if (!id) return 'Usa produto do fluxo';
      return id.includes('{{') ? 'Checkout dinâmico' : `Checkout ${id.slice(0, 8)}`;
    }
    case 'show_product': return text(d.productId) ?? 'Selecionar produto';
    case 'deliver_group': return text(d.message) ? cut(d.message, 60) : 'Convite para o grupo';
    case 'deliver_product': return text(d.message) ? cut(d.message, 60) : '';
    case 'create_lead': return `Status: ${text(d.status) ?? 'lead'}`;
    case 'send_webhook': return text(d.url) ? cut(d.url, 40) : 'Configurar URL';
    case 'tag_user': return Array.isArray(d.tags) && d.tags.length ? d.tags.join(', ') : 'Configurar tags';
    default: return '';
  }
}

/** buildOutputHandles: fixed handles, or one per button, case or path, colored as the editor does. */
function handlesOf(type: string, d: Payload, color: string): Handle[] {
  const list = (items: unknown, prefix: string, name: (item: Payload, i: number) => string) =>
    (Array.isArray(items) ? items : []).map((item, i) => ({ id: `${prefix}_${i}`, label: name(isPayload(item) ? item : {}, i), color }));
  if (type === 'ask_buttons') return list(d.options, 'option', (o, i) => text(o.label) ?? `Opção ${i + 1}`);
  if (type === 'randomizer') return list(d.paths, 'path', (p, i) => `${text(p.label) ?? `Caminho ${i + 1}`} (${count(p.weight)}%)`);
  if (type === 'switch') return [...list(d.cases, 'case', (_, i) => `Caso ${i + 1}`), { id: 'default', label: 'Default', color: DEFAULT_HANDLE_COLOR }];
  const outputs = NODES[type]?.outputs ?? ['default'];
  return outputs.map((id) => (HANDLES[id] ? { id, ...HANDLES[id] } : { id, label: '', color: DEFAULT_HANDLE_COLOR }));
}

function toNode(n: Payload): FlowNode {
  const type = String(n.type ?? '');
  const def = NODES[type];
  const color = def ? CATEGORY_COLORS[def.category] : DEFAULT_HANDLE_COLOR;
  const data = isPayload(n.data) ? n.data : {};
  const position = isPayload(n.position) ? n.position : {};
  return {
    id: String(n.id ?? ''),
    type,
    label: def?.label ?? type,
    category: def?.category ?? null,
    color,
    preview: nodePreview(type, data),
    x: typeof position.x === 'number' ? position.x : 0,
    y: typeof position.y === 'number' ? position.y : 0,
    hasInput: def?.category !== 'triggers',
    handles: handlesOf(type, data, color),
  };
}

/** get_telegram_flow `{ flow }`; null for anything else. */
export function summarizeFlow(data: unknown): Flow | null {
  if (!isPayload(data) || !isPayload(data.flow) || !Array.isArray(data.flow.nodes)) return null;
  const f = data.flow;
  const nodes = f.nodes.filter(isPayload).map(toNode);
  const ids = new Set(nodes.map((n: FlowNode) => n.id));
  const edges = (Array.isArray(f.edges) ? f.edges : []).filter(isPayload)
    .map((e) => ({ id: String(e.id ?? ''), source: String(e.source ?? ''), target: String(e.target ?? ''), handle: text(e.sourceHandle) ?? 'default' }))
    .filter((e) => ids.has(e.source) && ids.has(e.target));
  return {
    id: String(f.id ?? ''),
    name: text(f.name) ?? 'Flow',
    mode: f.mode === 'basic' ? 'basic' : 'visual',
    published: f.published === true,
    unpublished: f.hasUnpublishedChanges === true,
    nodes,
    edges,
  };
}

export interface FlowListItem {
  id: string;
  name: string;
  mode: 'basic' | 'visual';
  published: boolean;
  nodeCount: number;
}

/** list_telegram_flows `{ flows }`; null for anything else. */
export function summarizeFlowList(data: unknown): FlowListItem[] | null {
  if (!isPayload(data) || !Array.isArray(data.flows)) return null;
  return data.flows.filter(isPayload).map((f) => ({
    id: String(f.id ?? ''),
    name: text(f.name) ?? 'Flow',
    mode: f.mode === 'basic' ? 'basic' : 'visual',
    published: f.published === true,
    nodeCount: count(f.nodeCount),
  }));
}

/** The flows tab's mode name. */
export const modeLabel = (mode: Flow['mode']) => (mode === 'basic' ? 'Básico' : 'Visual');
