import type { App } from '@modelcontextprotocol/ext-apps';

export type ColorMode = 'light' | 'dark';

export interface HostSnapshot {
  /** Tool that produced the result, when the host says (hostContext.toolInfo). */
  toolName?: string;
  args: Record<string, unknown>;
  /** The result's structuredContent; undefined until it arrives. */
  payload?: unknown;
  error?: string;
  colorMode: ColorMode;
  /** The host proxies tools/call, so a view can re-run its tool or poll another one. */
  canCallTools: boolean;
  /** Bumped on every new tool call from the host: keys the view so its local state resets. */
  generation: number;
}

export interface Host {
  getSnapshot(): HostSnapshot;
  subscribe(listener: () => void): () => void;
  /** Calls a tool of this server through the host; resolves with its structuredContent. */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  /** Puts a short line in the model context, so the next turn knows what the view showed. */
  tellModel(text: string): void;
}

function applyTheme(theme: unknown): ColorMode | undefined {
  if (theme !== 'light' && theme !== 'dark') return undefined;
  // On the root, which also sets color-scheme: a light root in a dark host paints a white box.
  document.documentElement.dataset.theme = theme;
  return theme;
}

/**
 * The view's state, fed by the host. Handlers go on before connect(): the host can finish the
 * handshake and send the result before React's first commit, and those notifications are not resent.
 */
export function createHost(app: App): Host {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  let snapshot: HostSnapshot = {
    args: {},
    colorMode: applyTheme(prefersDark ? 'dark' : 'light') ?? 'light',
    canCallTools: false,
    generation: 0,
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<HostSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };

  app.ontoolinput = ({ arguments: args }) => {
    set({ args: args ?? {}, payload: undefined, error: undefined, generation: snapshot.generation + 1 });
  };
  app.ontoolresult = (result) => {
    if (result.isError) {
      const text = result.content?.find((c) => c.type === 'text');
      set({ error: text && 'text' in text ? text.text : 'A ferramenta devolveu um erro.' });
      return;
    }
    set({ payload: result.structuredContent, error: undefined });
  };
  app.onhostcontextchanged = (context) => {
    const colorMode = applyTheme(context.theme);
    if (colorMode) set({ colorMode });
  };

  app
    .connect()
    .then(() => {
      const context = app.getHostContext();
      set({
        colorMode: applyTheme(context?.theme) ?? snapshot.colorMode,
        toolName: context?.toolInfo?.tool.name,
        canCallTools: Boolean(app.getHostCapabilities()?.serverTools),
      });
    })
    .catch((error: Error) => set({ error: `Sem conexão com o app: ${error.message}` }));

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async callTool(name, args) {
      const result = await app.callServerTool({ name, arguments: args });
      if (result.isError) {
        const text = result.content?.find((c) => c.type === 'text');
        throw new Error(text && 'text' in text ? text.text : 'tool failed');
      }
      return result.structuredContent ?? null;
    },
    tellModel(text) {
      app.updateModelContext({ content: [{ type: 'text', text }] }).catch(() => {});
    },
  };
}
