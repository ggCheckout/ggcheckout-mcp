// The lucide icons the dashboard cards use (lucide-react in saas-checkout, ISC license), drawn as
// inline SVG: the views load nothing from the network.

const ICONS = {
  'shopping-cart': [['circle', { cx: 8, cy: 21, r: 1 }], ['circle', { cx: 19, cy: 21, r: 1 }],
    ['path', { d: 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12' }]],
  'dollar-sign': [['line', { x1: 12, x2: 12, y1: 2, y2: 22 }], ['path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: '12 6 12 12 16 14' }]],
  'alert-circle': [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 12, x2: 12, y1: 8, y2: 12 }], ['line', { x1: 12, x2: 12.01, y1: 16, y2: 16 }]],
  'trending-up': [['polyline', { points: '22 7 13.5 15.5 8.5 10.5 2 17' }], ['polyline', { points: '16 7 22 7 22 13' }]],
  'trending-down': [['polyline', { points: '22 17 13.5 8.5 8.5 13.5 2 7' }], ['polyline', { points: '16 17 22 17 22 11' }]],
  search: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', { d: 'm21 21-4.3-4.3' }]],
  info: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 16v-4' }], ['path', { d: 'M12 8h.01' }]],
};

export function icon(name, size = 16) {
  const ns = 'http://www.w3.org/2000/svg';
  const root = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) root.setAttribute(key, value);
  for (const [tag, attrs] of ICONS[name] ?? []) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    root.append(node);
  }
  return root;
}
