// Host bridge for an MCP Apps view (spec 2026-01-26): JSON-RPC 2.0 over postMessage with the host.
// Hand-written instead of @modelcontextprotocol/ext-apps: that package needs a bundler on the view
// side and SDK 2 on the server side, and the part a read-only view uses is this small.

const PROTOCOL_VERSION = '2026-01-26';

const bridge = {
  /** HostContext from ui/initialize, merged with every host-context-changed. */
  context: {},
  capabilities: {},
  toolInput: null,
  onToolInput: () => {},
  onToolResult: () => {},
  onTeardown: () => {},
};

let nextId = 1;
const pending = new Map();

function post(message) {
  window.parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
}

function request(method, params) {
  const id = nextId++;
  post({ id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function notify(method, params) {
  post({ method, params });
}

/** Calls a tool of this server through the host; resolves with its structuredContent. */
async function callTool(name, args) {
  if (!bridge.capabilities.serverTools) throw new Error('host does not proxy tool calls');
  const result = await request('tools/call', { name, arguments: args });
  if (result?.isError) throw new Error(result.content?.[0]?.text ?? 'tool failed');
  return result?.structuredContent ?? null;
}

/** Puts a short line in the model context, so the next turn knows what the view saw. */
function updateModelContext(text) {
  request('ui/update-model-context', { content: [{ type: 'text', text }] }).catch(() => {});
}

function applyContext(ctx) {
  Object.assign(bridge.context, ctx);
  const root = document.documentElement;
  if (ctx.theme) {
    root.dataset.theme = ctx.theme;
    root.style.colorScheme = ctx.theme;
  }
  for (const [key, value] of Object.entries(ctx.styles?.variables ?? {})) {
    if (value) root.style.setProperty(key, value);
  }
  const fonts = ctx.styles?.css?.fonts;
  if (fonts && !document.getElementById('host-fonts')) {
    const style = document.createElement('style');
    style.id = 'host-fonts';
    style.textContent = fonts;
    document.head.append(style);
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  const msg = event.data;
  if (!msg || msg.jsonrpc !== '2.0') return;

  if (msg.id !== undefined && !msg.method) {
    const waiter = pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error.message ?? 'host error'));
    else waiter.resolve(msg.result);
    return;
  }

  switch (msg.method) {
    case 'ui/notifications/tool-input':
      bridge.toolInput = msg.params?.arguments ?? {};
      bridge.onToolInput(bridge.toolInput);
      break;
    case 'ui/notifications/tool-result':
      bridge.onToolResult(msg.params ?? {});
      break;
    case 'ui/notifications/host-context-changed':
      applyContext(msg.params ?? {});
      break;
    case 'ui/resource-teardown':
      bridge.onTeardown();
      post({ id: msg.id, result: {} });
      break;
    case 'ping':
      post({ id: msg.id, result: {} });
      break;
    default:
      // A request this view does not handle still gets an answer, so the host does not wait on it.
      if (msg.id !== undefined) post({ id: msg.id, error: { code: -32601, message: `unsupported: ${msg.method}` } });
  }
});

// Flexible-height hosts size the iframe from this, so report the content height as it changes.
let lastHeight = 0;
new ResizeObserver(() => {
  const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
  if (height === lastHeight) return;
  lastHeight = height;
  notify('ui/notifications/size-changed', { width: document.documentElement.scrollWidth, height });
}).observe(document.documentElement);

async function connect(appName) {
  const result = await request('ui/initialize', {
    appInfo: { name: appName, version: '1.0.0' },
    appCapabilities: {},
    protocolVersion: PROTOCOL_VERSION,
  });
  bridge.capabilities = result?.hostCapabilities ?? {};
  applyContext(result?.hostContext ?? {});
  notify('ui/notifications/initialized', {});
}
