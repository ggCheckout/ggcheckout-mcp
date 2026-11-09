// A real MCP Apps host for the views, in the browser: each frame runs the app (served by Vite, with
// HMR) under an AppBridge over PostMessageTransport, the same handshake Claude Desktop does, fed
// by the fixtures. `?only=<scenario>` shows one; `?theme=light|dark` one theme.
import { PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { answerTool, SCENARIOS, type Scenario } from './scenarios';

type Theme = 'light' | 'dark';
const params = new URLSearchParams(location.search);
const themes: Theme[] = params.get('theme') === 'light' ? ['light'] : params.get('theme') === 'dark' ? ['dark'] : ['light', 'dark'];
const scenarios = SCENARIOS.filter((s) => !params.get('only') || s.id === params.get('only'));
const log: string[] = [];
(window as unknown as { __hostLog: string[] }).__hostLog = log;

async function mount(scenario: Scenario, theme: Theme, slot: HTMLElement) {
  const frame = document.createElement('iframe');
  frame.title = `${scenario.id} (${theme})`;
  frame.src = '/app/app.html';
  slot.append(frame);
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));

  const polls = { count: 0 };
  const bridge = new AppBridge(null, { name: 'ggcheckout-preview', version: '1.0.0' }, { serverTools: {} }, {
    hostContext: { theme, displayMode: 'inline', toolInfo: { tool: { name: scenario.tool, inputSchema: { type: 'object' } } } },
  });
  bridge.oncalltool = async ({ name, arguments: args }) => {
    log.push(`${scenario.id}: tools/call ${name} ${JSON.stringify(args)}`);
    const structuredContent = answerTool(name, args ?? {}, polls) as Record<string, unknown>;
    return { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent };
  };
  bridge.onupdatemodelcontext = async ({ content }) => {
    log.push(`${scenario.id}: model context ${JSON.stringify(content)}`);
    return {};
  };
  bridge.onsizechange = ({ height }) => {
    if (height) frame.style.height = `${height}px`;
  };
  bridge.oninitialized = () => {
    void bridge.sendToolInput({ arguments: scenario.args });
    void bridge.sendToolResult({
      content: [{ type: 'text', text: JSON.stringify(scenario.result) }],
      structuredContent: scenario.result as Record<string, unknown>,
    });
  };
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
}

const grid = document.getElementById('grid')!;
grid.style.setProperty('--columns', String(themes.length));
for (const scenario of scenarios) {
  const row = document.createElement('section');
  row.innerHTML = `<h2>${scenario.question} <code>${scenario.tool}</code></h2><div class="pair"></div>`;
  grid.append(row);
  for (const theme of themes) {
    const slot = document.createElement('div');
    slot.className = `slot ${theme}`;
    row.querySelector('.pair')!.append(slot);
    void mount(scenario, theme, slot);
  }
}
