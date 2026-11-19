import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Host, HostSnapshot } from '../host';
import { RewardsView } from './RewardsView';

const host = (): Host => ({
  getSnapshot: vi.fn(), subscribe: vi.fn(), callTool: vi.fn(), tellModel: vi.fn(), openLink: vi.fn(),
});
const state: HostSnapshot = {
  toolName: 'calculate_rewards', args: {}, colorMode: 'light', canCallTools: true, generation: 1,
  payload: { currentRevenue: 6000, milestones: [5000, 10000] },
};

// A click cannot be driven here (no DOM in the ui workspace): this pins the closed state the click starts from.
describe('RewardsView group redeem', () => {
  it('starts as a button, with no confirmation open and no write sent', () => {
    const h = host();
    const html = renderToStaticMarkup(<RewardsView host={h} state={state} />);
    expect(html).toContain('Entrar no grupo');
    expect(html).not.toContain('alertdialog');
    expect(h.callTool).not.toHaveBeenCalled();
  });
});
