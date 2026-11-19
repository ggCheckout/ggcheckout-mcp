// Lays a flow out for the read-only canvas: the editor's positions, node boxes of a fixed size so the
// edges meet them, and one route per edge. An edge goes straight down to its target when nothing is in
// the way; one that goes back up (a remarketing loop) or would cross another node runs down a lane of
// its own on the right. Pure.

import type { Flow, FlowNode } from './model';

export const NODE_W = 240;
const NODE_H = 76;
const HANDLE_ROW = 28;
const PAD = 24;
/** Gap between the rightmost node in the way and the first lane, and between lanes. */
const LANE_GAP = 28;
const LANE_STEP = 14;

export const isLabeled = (n: FlowNode) => n.handles.some((h) => h.label);
export const heightOf = (n: FlowNode) => NODE_H + (isLabeled(n) ? HANDLE_ROW : 0);

export interface Placed {
  x: number;
  y: number;
  node: FlowNode;
}

export interface Route {
  id: string;
  d: string;
  color: string;
  /** Runs down a side lane. */
  side: boolean;
}

export interface Layout {
  width: number;
  height: number;
  nodes: Placed[];
  routes: Route[];
}

/** Where an output handle leaves the node: spread along the bottom when they are labeled. */
function handlePoint(p: Placed, handleId: string) {
  const { handles } = p.node;
  const i = Math.max(0, handles.findIndex((h) => h.id === handleId));
  const x = isLabeled(p.node) ? p.x + (NODE_W * (i + 1)) / (handles.length + 1) : p.x + NODE_W / 2;
  return { x, y: p.y + heightOf(p.node), color: handles[i]?.color ?? '#94a3b8' };
}

/** A node other than the two ends inside the box the straight edge would sweep. */
function inTheWay(nodes: Placed[], from: Placed, to: Placed, sx: number, sy: number, tx: number, ty: number) {
  const left = Math.min(sx, tx) - 8;
  const right = Math.max(sx, tx) + 8;
  return nodes.some((n) => n !== from && n !== to && n.y < ty && n.y + heightOf(n.node) > sy && n.x < right && n.x + NODE_W > left);
}

export function layout(flow: Flow): Layout {
  const minX = Math.min(...flow.nodes.map((n) => n.x));
  const minY = Math.min(...flow.nodes.map((n) => n.y));
  const nodes = flow.nodes.map((node) => ({ x: node.x - minX + PAD, y: node.y - minY + PAD, node }));
  const byId = new Map(nodes.map((p) => [p.node.id, p]));
  let right = Math.max(...nodes.map((p) => p.x + NODE_W));
  const height = Math.max(...nodes.map((p) => p.y + heightOf(p.node))) + PAD;

  let lanes = 0;
  const routes = flow.edges.map((e) => {
    const from = byId.get(e.source)!;
    const to = byId.get(e.target)!;
    const { x: sx, y: sy, color } = handlePoint(from, e.handle);
    const tx = to.x + NODE_W / 2;
    const ty = to.y - 2;
    if (ty >= sy + 12 && !inTheWay(nodes, from, to, sx, sy, tx, ty)) {
      const dy = (ty - sy) / 2;
      return { id: e.id, d: `M${sx},${sy} C${sx},${sy + dy} ${tx},${ty - dy} ${tx},${ty}`, color, side: false };
    }
    // Out to the right of every node between the two ends, down (or up) its own lane, into the target.
    const top = Math.min(sy, to.y);
    const bottom = Math.max(sy, ty);
    const edgeOfBlock = Math.max(...nodes.filter((n) => n.y < bottom && n.y + heightOf(n.node) > top).map((n) => n.x + NODE_W), from.x + NODE_W, to.x + NODE_W);
    const lx = edgeOfBlock + LANE_GAP + LANE_STEP * lanes++;
    right = Math.max(right, lx);
    // Downward, the lane is a straight run; back up, the two bends meet halfway.
    const d = ty - sy > 160
      ? `M${sx},${sy} C${sx},${sy + 40} ${lx},${sy + 40} ${lx},${sy + 80} L${lx},${ty - 80} C${lx},${ty - 40} ${tx},${ty - 40} ${tx},${ty}`
      : `M${sx},${sy} C${sx},${sy + 40} ${lx},${sy + 40} ${lx},${(sy + ty) / 2} C${lx},${ty - 40} ${tx},${ty - 40} ${tx},${ty}`;
    return { id: e.id, d, color, side: true };
  });
  return { width: right + PAD, height, nodes, routes };
}
