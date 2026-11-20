import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Host, HostSnapshot } from '../host';
import { InboxView } from './InboxView';
import { Bubble } from './Thread';

const host = (): Host => ({
  getSnapshot: vi.fn(), subscribe: vi.fn(), callTool: vi.fn(), tellModel: vi.fn(), openLink: vi.fn(),
});
const snapshot = (payload: unknown, canCallTools = true): HostSnapshot => ({
  toolName: 'open_whatsapp_inbox', args: {}, colorMode: 'light', canCallTools, generation: 1, payload,
});

describe('InboxView gates', () => {
  it('says the inbox is not available yet on an account without the routes, and reads nothing', () => {
    const h = host();
    const html = renderToStaticMarkup(<InboxView host={h} state={snapshot({ available: false, enabled: false, conversations: 0, unread: 0 })} />);
    expect(html).toContain('ainda não está disponível nesta conta');
    expect(h.callTool).not.toHaveBeenCalled();
  });

  it('tells the seller to turn on "Permitir acesso pelo MCP" in the panel when it is off, and reads nothing', () => {
    const h = host();
    const html = renderToStaticMarkup(<InboxView host={h} state={snapshot({ available: true, enabled: false, conversations: 0, unread: 0 })} />);
    expect(html).toContain('Permitir acesso pelo MCP');
    expect(html).toContain('no painel');
    expect(h.callTool).not.toHaveBeenCalled();
  });

  it('explains a host that cannot proxy tool calls instead of showing an empty inbox', () => {
    const html = renderToStaticMarkup(<InboxView host={host()} state={snapshot({ available: true, enabled: true, conversations: 1, unread: 0 }, false)} />);
    expect(html).toContain('não deixa o app chamar as ferramentas');
  });

  it('opens to the conversation list while it loads', () => {
    const html = renderToStaticMarkup(<InboxView host={host()} state={snapshot({ available: true, enabled: true, conversations: 1, unread: 0 })} />);
    expect(html).toContain('Caixa de entrada');
    expect(html).toContain('aria-busy="true"');
  });

  it('refuses a payload that is not the inbox', () => {
    expect(renderToStaticMarkup(<InboxView host={host()} state={snapshot({ numbers: [] })} />)).toContain('não trouxe a caixa de entrada');
  });
});

describe('message text', () => {
  it('is rendered as text: markup in a customer message stays literal', () => {
    const html = renderToStaticMarkup(
      <Bubble message={{ id: '1-1', dir: 'in', type: 'text', text: '<img src=x onerror=alert(1)><b>oi</b>', at: '2026-11-20T12:00:00Z', auto: false }} />,
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&lt;b&gt;oi&lt;/b&gt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
  });

  it('never goes through dangerouslySetInnerHTML anywhere in the inbox view', () => {
    for (const file of ['InboxView.tsx', 'Thread.tsx']) {
      expect(readFileSync(new URL(`./${file}`, import.meta.url), 'utf-8')).not.toContain('dangerouslySetInnerHTML');
    }
  });

  it('shows what kind of message a medialess bubble was', () => {
    const html = renderToStaticMarkup(<Bubble message={{ id: '1-2', dir: 'in', type: 'media', text: null, at: null, auto: false }} />);
    expect(html).toContain('Mídia');
  });
});
