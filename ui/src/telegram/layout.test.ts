import { describe, expect, it } from 'vitest';
import { layout, NODE_W } from './layout';
import { summarizeFlow } from './model';

const node = (id: string, type: string, x: number, y: number, data: Record<string, unknown> = {}) => ({ id, type, position: { x, y }, data });
const edge = (source: string, target: string, sourceHandle = 'default') => ({ id: `${source}-${target}`, source, target, sourceHandle });

// The basic flows are one column: a PIX whose "expired" skips the "approved" message, and a loop back up.
const column = summarizeFlow({
  flow: {
    id: 'f', name: 'PIX', mode: 'basic', nodes: [
      node('pix', 'pix_payment', 300, 0), node('ok', 'send_text', 300, 130), node('late', 'send_text', 300, 250), node('wait', 'delay', 300, 370),
    ],
    edges: [edge('pix', 'ok', 'approved'), edge('pix', 'late', 'expired'), edge('late', 'wait'), edge('wait', 'late')],
  },
})!;

describe('flow layout', () => {
  it('starts at the padding and keeps the editor positions', () => {
    const { nodes } = layout(column);
    expect(nodes.map((n) => [n.x, n.y])).toEqual([[24, 24], [24, 154], [24, 274], [24, 394]]);
  });

  it('goes straight down when nothing is in the way', () => {
    const routes = layout(column).routes;
    expect(routes.find((r) => r.id === 'pix-ok')!.side).toBe(false);
    expect(routes.find((r) => r.id === 'late-wait')!.side).toBe(false);
  });

  it('takes a lane of its own past a node in the way and back up a loop', () => {
    const { routes, width } = layout(column);
    const skip = routes.find((r) => r.id === 'pix-late')!;
    const loop = routes.find((r) => r.id === 'wait-late')!;
    expect(skip.side && loop.side).toBe(true);
    expect(skip.d).not.toBe(loop.d);
    expect(width).toBeGreaterThan(24 + NODE_W + 28);
  });

  it('colors an edge by the handle it leaves from', () => {
    expect(layout(column).routes.find((r) => r.id === 'pix-late')!.color).toBe('#ef4444');
  });
});
