// Sales view, attached to get_dashboard_stats and get_dashboard_charts. It draws what the call
// answered: the stats as metric cards, one `focus` of the charts (the part the user asked about),
// or the whole panel. The period buttons call the same tool, with the same focus, through the host.

const SVG_NS = 'http://www.w3.org/2000/svg';
const content = document.getElementById('content');
const rangesBox = document.getElementById('ranges');
const title = document.getElementById('title');

let range = 'week';
let timezone;
let summary = null;
/** Which tool answered: 'charts' or 'stats'. */
let source = 'charts';

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function rangeLabel(value) {
  return DASHBOARD_RANGES.find((r) => r.value === value)?.label ?? value;
}

function renderRanges() {
  const interactive = Boolean(bridge.capabilities.serverTools);
  rangesBox.hidden = !interactive;
  rangesBox.replaceChildren(...DASHBOARD_RANGES.map((r) => el('button', {
    type: 'button',
    'aria-pressed': String(r.value === range),
    onclick: () => r.value !== range && switchRange(r.value),
  }, r.label)));
}

async function switchRange(next) {
  const previous = range;
  range = next;
  renderRanges();
  content.setAttribute('aria-busy', 'true');
  try {
    const data = source === 'stats'
      ? await callTool('get_dashboard_stats', { range: next })
      : await callTool('get_dashboard_charts', {
        range: next,
        ...(timezone ? { tz: timezone } : {}),
        ...(summary?.focus ? { focus: summary.focus } : {}),
      });
    show(data);
  } catch (error) {
    range = previous;
    renderRanges();
    content.removeAttribute('aria-busy');
    content.prepend(el('p', { class: 'state', 'data-tone': 'error', role: 'alert' }, `Não deu para trocar o período: ${error.message}`));
  }
}

// KPI tile of the full panel and the refunds focus: the dashboard's `metric` surface, neutral tone.
function metric(label, value) {
  return el('div', { class: 'metric neutral kpi' },
    el('p', { class: 'kpi-label' }, label),
    el('p', { class: 'kpi-value num' }, value));
}

function panel(className, ...children) {
  return el('section', { class: `surface ${className}` }, ...children);
}

function infoTip(text) {
  return el('span', { class: 'info', title: text, 'aria-label': text, role: 'img' }, icon('info', 16));
}

function segmented(options, active, onPick, className = '') {
  return el('div', { class: `row segmented ${className}`, role: 'group' }, options.map(([value, label]) => el('button', {
    type: 'button',
    'aria-pressed': String(value === active),
    onclick: () => value !== active && onPick(value),
  }, label)));
}

// ---- StatsCards ------------------------------------------------------------------------------

const formatChange = (value) => (value == null || Number.isNaN(value) ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`);

/** One-line value that shrinks with the card, as `fitOneLineFontSize` does on the dashboard. */
const fitOneLine = (text, maxRem) => `font-size: max(1rem, min(${maxRem}rem, ${(100 / (String(text).length * 0.62)).toFixed(2)}cqi))`;

function statCard(card) {
  const value = card.change ?? 0;
  const good = card.invert ? value <= 0 : value >= 0;
  return el('div', { class: `metric ${card.tone}`, 'data-metric': card.id },
    el('div', { class: 'stat-top' },
      el('p', { class: 'stat-title' }, card.title),
      el('span', { class: 'stat-icon' }, icon(card.icon, 24))),
    el('div', { class: 'stat-value-row' }, el('p', { class: 'stat-value', style: fitOneLine(card.value, 1.875) }, card.value)),
    el('div', { class: 'stat-foot' },
      card.hideChange ? null : icon(good ? 'trending-up' : 'trending-down', 16),
      card.hideChange ? null : el('span', { class: 'stat-change' }, formatChange(card.change)),
      el('span', { class: 'stat-desc' }, card.description)));
}

function statsCards(s) {
  const period = s.period ?? range;
  const comparison = COMPARISON_LABELS[period] ?? COMPARISON_LABELS.custom;
  return el('div', { class: 'stats' }, [
    { id: 'sales', title: 'Total de Vendas', icon: 'shopping-cart', tone: 'success', value: String(s.sales), change: s.salesChange, description: comparison },
    { id: 'revenue', title: 'Receita Total', icon: 'dollar-sign', tone: 'success', value: formatCents(s.revenue), change: s.revenueChange, description: comparison },
    { id: 'pending', title: 'Vendas Pendentes', icon: 'clock', tone: 'warning', value: String(s.pending), change: s.pendingChange, description: 'aguardando pagamento', invert: true },
    { id: 'expired', title: 'Vendas Expiradas', icon: 'alert-circle', tone: 'danger', value: String(s.expired), description: PERIOD_LABELS[period] ?? PERIOD_LABELS.custom, hideChange: true },
  ].map(statCard));
}

// ---- SalesChart ------------------------------------------------------------------------------

function drawChart(box, series) {
  const width = box.clientWidth;
  const height = box.clientHeight;
  if (!width) return;
  if (!series.length) {
    box.replaceChildren(el('p', { class: 'chart-empty' }, 'Nenhum dado disponível'));
    return;
  }
  // Recharts AreaChart: margin top 10 right 10, a 45px y axis, the x ticks below the plot.
  const pad = { top: 10, right: 10, bottom: 30, left: 45 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const ticks = chartTicks(Math.max(...series.map((p) => p.revenue)));
  const top = ticks[ticks.length - 1] || 1;
  const x = (i) => pad.left + (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);
  const y = (v) => pad.top + h - (v / top) * h;

  const root = svg('svg', { width, height, role: 'img', 'aria-label': `Receita no período: ${formatCents(summary.revenue)}` });
  const fill = svg('linearGradient', { id: 'colorRevenue', x1: 0, y1: 0, x2: 0, y2: 1 });
  fill.append(svg('stop', { offset: '5%', 'stop-opacity': 0.3 }), svg('stop', { offset: '95%', 'stop-opacity': 0 }));
  const defs = svg('defs');
  defs.append(fill);
  root.append(defs);
  for (const tick of ticks) {
    const label = svg('text', { class: 'axis', x: pad.left - 5, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' });
    label.textContent = chartTickLabel(tick);
    root.append(label);
  }
  // interval="preserveStartEnd": first and last always, the rest as room allows.
  const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(w / 48))));
  series.forEach((p, i) => {
    const last = i === series.length - 1;
    if (!last && i % every !== 0) return;
    if (last && i % every !== 0 && (x(i) - x(i - (i % every))) < 40) return;
    const label = svg('text', { class: 'axis', x: x(i), y: pad.top + h + 10 + 12, 'text-anchor': 'middle' });
    label.textContent = p.label;
    root.append(label);
  });

  // monotone curve through the points (Fritsch-Carlson, the d3 curveMonotoneX Recharts uses).
  const pts = series.map((p, i) => [x(i), y(p.revenue)]);
  const line = monotonePath(pts);
  root.append(svg('path', { class: 'area', d: `${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z` }));
  root.append(svg('path', { class: 'line', d: line }));

  const dot = svg('circle', { class: 'dot', r: 6, visibility: 'hidden' });
  root.append(dot);
  const tip = el('div', { class: 'tip', hidden: true });

  const hide = () => { dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  const hit = svg('rect', { x: pad.left - 6, y: 0, width: w + 12, height, fill: 'transparent' });
  hit.addEventListener('pointermove', (event) => {
    const rect = root.getBoundingClientRect();
    const rel = (event.clientX - rect.left - pad.left) / w;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(rel * (series.length - 1))));
    const p = series[i];
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(p.revenue)); dot.setAttribute('visibility', 'visible');
    tip.replaceChildren(el('p', { class: 'tip-value' }, formatCents(p.revenue)), el('p', { class: 'tip-label' }, p.label));
    tip.hidden = false;
    const right = x(i) + 12;
    tip.style.left = `${right + tip.offsetWidth > width ? Math.max(0, x(i) - tip.offsetWidth - 12) : right}px`;
    tip.style.top = `${Math.max(0, y(p.revenue) - tip.offsetHeight / 2)}px`;
  });
  hit.addEventListener('pointerleave', hide);
  root.append(hit);
  box.replaceChildren(root, tip);
}

function monotonePath(pts) {
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const dx = [], slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    slope[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i++) tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]);
  tangent[n - 1] = slope[n - 2];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    d += ` C${pts[i][0] + third},${pts[i][1] + third * tangent[i]} ${pts[i + 1][0] - third},${pts[i + 1][1] - third * tangent[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function salesChart(s, chartBox) {
  return panel('analytics chart-card art-sales-chart',
    el('header', { class: 'chart-head' },
      el('span', { class: 'chart-icon' }, el('img', { src: 'art:icon-sales.avif', alt: '' })),
      el('div', {},
        el('h3', { class: 'card-title' }, 'Vendas'),
        el('p', { class: 'card-sub' }, 'Receita no período selecionado'))),
    el('div', { class: 'chart-body' },
      el('div', { class: 'chart-summary' },
        el('span', { class: 'chart-total num' }, formatCents(s.revenue))),
      chartBox));
}

// ---- ApprovalRate (by gateway) --------------------------------------------------------------

function gatewayMark(raw) {
  const logo = gatewayLogo(raw);
  return el('span', { class: 'gw-mark' }, logo
    ? el('img', { src: logo, alt: '' })
    : el('span', { class: 'gw-initial' }, gatewayName(raw).charAt(0).toUpperCase()));
}

// As ApprovalRate on the seller dashboard: one row per method that opens into its gateways. Inside
// the approval focus the rows start open, since the gateways are the answer.
function methodRow(m, open) {
  const rate = m.rate == null ? 'N/A' : formatPercent(m.rate);
  return el('details', { class: 'method', 'data-method': m.key, open: open && m.byGateway.length > 0 },
    el('summary', { class: 'method-row' },
      el('span', { class: 'method-icon' }, el('img', { src: METHOD_ICONS[m.key] ?? METHOD_ICONS.gateway, alt: '' })),
      el('span', { class: 'method-text' },
        el('strong', {}, m.label),
        el('span', { class: 'muted num' }, `${formatInt(m.approved)}/${formatInt(m.total)}`)),
      el('span', { class: 'method-bar' }, el('span', { style: `width: ${(m.rate ?? 0) * 100}%` })),
      el('span', { class: 'method-rate num' }, rate),
      m.byGateway.length ? el('span', { class: 'chevron', 'aria-hidden': 'true' }) : null),
    m.byGateway.length ? el('div', { class: 'gw-list' }, m.byGateway.map((g) => el('div', { class: 'gw-row' },
      gatewayMark(g.gateway),
      el('span', { class: 'gw-name' }, gatewayName(g.gateway)),
      el('span', { class: 'muted num' }, `${formatInt(g.approved)}/${formatInt(g.total)}`),
      el('span', { class: 'gw-rate num' }, g.rate == null ? 'N/A' : formatPercent(g.rate))))) : null);
}

function approvalPanel(s) {
  const open = s.focus === 'approval';
  return panel('insight list-card art-approval-rate',
    el('header', { class: 'list-head' }, el('h3', { class: 'card-title' }, 'Taxa de Aprovação')),
    el('div', { class: 'list-body' }, s.approval.length
      ? s.approval.map((m) => methodRow(m, open))
      : el('p', { class: 'empty' }, 'Nenhuma tentativa no período')));
}

// ---- SalesByProduct (RankedList) --------------------------------------------------------------

const BAR_COLORS = ['#3b82f6', '#22d3ee', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16'];
const VISIBLE_LIMIT = 5;
const productState = { tab: 'products', expanded: false, query: '', order: 'desc', selected: new Set() };

function rankedRows(items) {
  const sorted = [...items].sort((a, b) => (productState.order === 'desc' ? b.count - a.count : a.count - b.count));
  const ranked = sorted.map((item, i) => ({ ...item, rank: i + 1, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const q = productState.query.trim().toLowerCase();
  return q ? ranked.filter((item) => item.name.toLowerCase().includes(q)) : ranked;
}

function productsPanel(s) {
  const card = panel('insight list-card art-sales-by-product');
  const draw = () => {
    const items = productState.tab === 'bumps' && s.orderBumps.length ? s.orderBumps : s.products;
    const rows = rankedRows(items);
    const max = Math.max(1, ...items.map((p) => p.count));
    const visible = productState.expanded ? rows : rows.slice(0, VISIBLE_LIMIT);
    const picked = items.filter((p) => productState.selected.has(p.name));
    const total = (picked.length ? picked : items).reduce((sum, p) => sum + p.count, 0);
    const search = el('input', {
      class: 'search', type: 'search', placeholder: 'Buscar produto...', value: productState.query, 'aria-label': 'Buscar produto',
      oninput: (event) => { productState.query = event.target.value; draw(); card.querySelector('.search')?.focus(); },
    });
    const tabs = [['products', 'Produtos'], ...(s.orderBumps.length ? [['bumps', 'Order Bumps']] : [])];
    card.replaceChildren(
      el('header', { class: 'list-head' },
        el('div', { class: 'list-title' },
          el('h3', { class: 'card-title' }, 'Vendas por Produto'),
          infoTip('Distribuição de vendas aprovadas por produto no período selecionado.')),
        segmented(tabs, productState.tab, (next) => {
          Object.assign(productState, { tab: next, expanded: false, query: '' });
          productState.selected.clear();
          draw();
        }, 'tabs'),
        items.length ? el('div', { class: 'tools' },
          el('label', { class: 'search-box' }, icon('search', 14), search),
          el('button', {
            type: 'button', class: 'icon-btn', title: productState.order === 'desc' ? 'Maior para menor' : 'Menor para maior',
            'aria-label': productState.order === 'desc' ? 'Maior para menor' : 'Menor para maior',
            onclick: () => { productState.order = productState.order === 'desc' ? 'asc' : 'desc'; draw(); },
          }, productState.order === 'desc' ? '↓' : '↑'),
          productState.selected.size ? el('button', {
            type: 'button', class: 'chip', onclick: () => { productState.selected.clear(); draw(); },
          }, `${productState.selected.size} selecionados ×`) : null) : null),
      el('div', { class: 'list-body' },
        items.length ? el('div', { class: productState.expanded ? 'ranked expanded' : 'ranked' }, visible.map((p) => el('button', {
          type: 'button', class: productState.selected.has(p.name) ? 'rank-row selected' : 'rank-row',
          'aria-pressed': String(productState.selected.has(p.name)),
          onclick: () => { productState.selected.has(p.name) ? productState.selected.delete(p.name) : productState.selected.add(p.name); draw(); },
        },
          el('span', { class: 'rank-line' },
            el('span', { class: 'rank-dot', style: `background: ${p.color}` }),
            el('span', { class: 'rank-n' }, `${p.rank}.`),
            el('span', { class: 'rank-name', title: p.name }, p.name),
            el('span', { class: 'rank-count num' }, p.count.toLocaleString('pt-BR')),
            el('span', { class: 'rank-pct' }, `${p.percentage.toFixed(0)}%`)),
          el('span', { class: 'rank-track' }, el('span', { style: `width: ${(p.count / max) * 100}%; background: ${p.color}` })))))
          : el('p', { class: 'empty' }, 'Nenhuma venda no período'),
        items.length ? el('div', { class: 'list-foot' },
          el('span', {}, picked.length ? `Selecionados: ${picked.length} (${total} vendas)` : `Total: ${total} vendas`),
          rows.length > VISIBLE_LIMIT ? el('button', {
            type: 'button', class: 'more', onclick: () => { productState.expanded = !productState.expanded; draw(); },
          }, productState.expanded ? 'Ver menos' : 'Ver mais') : null) : null));
  };
  draw();
  return card;
}

// ---- SalesByState ----------------------------------------------------------------------------

const RANK_BADGES = ['#f59e0b', '#9ca3af', '#b45309'];
let stateView = 'map';

function stateTone(count, max) {
  if (!count) return 'none';
  const intensity = count / max;
  return intensity > 0.8 ? '5' : intensity > 0.6 ? '4' : intensity > 0.4 ? '3' : intensity > 0.2 ? '2' : '1';
}

function noLocation(withIcon, hint) {
  return el('div', { class: 'no-location' },
    withIcon ? el('img', { src: 'art:icon-location.avif', alt: '', width: 32, height: 32 }) : null,
    el('p', { class: 'no-location-title' }, 'Sem dados de localização'),
    el('p', { class: 'no-location-hint' }, hint));
}

function statesMap(s) {
  const byCode = Object.fromEntries(s.states.map((st) => [st.state, st]));
  const max = Math.max(1, ...s.states.map((st) => st.count));
  const total = s.states.reduce((sum, st) => sum + st.count, 0);
  const popover = el('div', { class: 'state-pop', hidden: true });
  const map = svg('svg', { viewBox: '50 20 400 440', class: 'brazil', role: 'img', 'aria-label': 'Mapa de vendas por estado' });
  for (const [code, st] of Object.entries(BRAZIL_STATES)) {
    const data = byCode[code];
    const g = svg('g');
    const path = svg('path', { d: st.path, class: 'uf', 'data-tone': stateTone(data?.count, max) });
    path.addEventListener('pointerenter', () => {
      if (!data) return;
      popover.replaceChildren(el('p', { class: 'pop-name' }, st.name), el('p', { class: 'pop-line' }, `${data.count} vendas • ${formatCents(data.revenue)}`));
      popover.hidden = false;
    });
    path.addEventListener('pointerleave', () => { popover.hidden = true; });
    const label = svg('text', { x: st.labelX, y: st.labelY, class: 'uf-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    label.textContent = code;
    g.append(path, label);
    map.append(g);
  }
  const top = s.states.slice(0, 3);
  return el('div', { class: 'map-view' },
    el('div', { class: 'map-box' }, map, popover),
    top.length ? el('div', { class: 'top-states' },
      el('p', { class: 'top-title' }, 'Top Estados'),
      top.map((st, i) => el('div', { class: 'top-row' },
        el('span', { class: 'top-left' },
          el('span', { class: 'badge', style: `background: ${RANK_BADGES[i]}` }, String(i + 1)),
          el('span', { class: 'top-name' }, BRAZIL_STATES[st.state]?.name ?? st.state)),
        el('span', { class: 'top-count' }, `${st.count} (${((st.count / total) * 100).toFixed(0)}%)`))))
      : el('div', { class: 'top-states' }, noLocation(false, 'Habilite frete nos checkouts para coletar endereços')));
}

function statesList(s) {
  const total = s.states.reduce((sum, st) => sum + st.count, 0);
  if (!s.states.length) return noLocation(true, 'Dados disponíveis apenas para vendas com endereço (checkout com frete habilitado)');
  return el('div', { class: 'state-list' }, s.states.map((st) => el('div', { class: 'state-row' },
    el('span', { class: 'state-left' },
      el('img', { src: 'art:icon-location.avif', alt: '', width: 20, height: 20 }),
      el('span', {}, BRAZIL_STATES[st.state]?.name ?? st.state)),
    el('span', { class: 'state-right' },
      el('span', { class: 'state-track' }, el('span', { style: `width: ${total > 0 ? (st.count / total) * 100 : 0}%` })),
      el('span', { class: 'state-nums' },
        el('span', { class: 'state-count' }, String(st.count)),
        el('span', { class: 'state-rev' }, formatCents(st.revenue)))))));
}

function statesPanel(s) {
  const card = panel('analytics states-card');
  const draw = () => card.replaceChildren(
    el('header', { class: 'states-head' },
      el('div', { class: 'states-title' },
        el('h3', { class: 'card-title small' }, 'Vendas por Estado'),
        segmented([['map', 'Mapa'], ['list', 'Lista']], stateView, (next) => { stateView = next; draw(); }, 'tight')),
      infoTip('Vendas aprovadas com endereço de entrega, por estado.')),
    el('div', { class: 'states-body' }, stateView === 'map' ? statesMap(s) : statesList(s)));
  draw();
  return card;
}

// ---- Screens ----------------------------------------------------------------------------------

const FOCUS_TITLE = {
  revenue: 'Faturamento',
  approval: 'Aprovação por método',
  products: 'Mais vendidos',
  states: 'Vendas por estado',
  refunds: 'Reembolsos',
};

function renderFocus(s, chartBox) {
  switch (s.focus) {
    case 'revenue': return [salesChart(s, chartBox)];
    case 'approval': return [approvalPanel(s)];
    case 'products': return [productsPanel(s)];
    case 'states': return [statesPanel(s)];
    case 'refunds': return [el('div', { class: 'kpis' },
      metric('Reembolsos', formatInt(s.refunds.refund)),
      metric('Chargebacks', formatInt(s.refunds.chargeback)),
      metric('MED', formatInt(s.refunds.med)))];
    default: return [];
  }
}

function renderFull(s, chartBox) {
  return [
    el('div', { class: 'kpis' },
      metric('Ticket médio', formatCents(s.averageTicket)),
      metric('Conversão', formatPercent(s.conversion)),
      metric('Reembolsos', formatInt(s.refundsTotal))),
    salesChart(s, chartBox),
    el('div', { class: 'panels' }, approvalPanel(s), productsPanel(s), statesPanel(s)),
    timezone ? el('p', { class: 'foot' }, `Fuso ${timezone}`) : null,
  ];
}

function render() {
  const s = summary;
  const heading = source === 'stats' ? 'Vendas' : FOCUS_TITLE[s.focus] ?? 'Vendas';
  title.textContent = `${heading} · ${rangeLabel(s.period ?? range)}`;
  // A focused answer is one dashboard card, which carries its own title.
  title.hidden = source === 'charts' && Boolean(s.focus);
  const chartBox = el('div', { class: 'chart' });
  content.replaceChildren(...(source === 'stats' ? [statsCards(s)] : s.focus ? renderFocus(s, chartBox) : renderFull(s, chartBox)));
  content.removeAttribute('aria-busy');
  if (chartBox.isConnected) drawChart(chartBox, s.series);
}

function show(data) {
  const stats = summarizeStats(data);
  const next = stats ?? summarizeDashboard(data);
  if (!next) {
    content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error' }, 'A resposta não trouxe dados do painel.'));
    return;
  }
  source = stats ? 'stats' : 'charts';
  summary = next;
  productState.selected.clear();
  if (DASHBOARD_RANGES.some((r) => r.value === data.period)) range = data.period;
  if (data.timezone) timezone = data.timezone;
  renderRanges();
  render();
  const what = source === 'stats' ? 'Vendas' : FOCUS_TITLE[summary.focus] ?? 'Painel de vendas';
  updateModelContext(`${what} aberto em "${rangeLabel(range)}" na tela do chat.`);
}

bridge.onToolInput = (args) => {
  if (args.range) range = args.range;
  if (args.tz) timezone = args.tz;
};
bridge.onToolResult = (result) => {
  if (result.isError) {
    content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error', role: 'alert' }, result.content?.[0]?.text ?? 'Erro ao carregar o painel.'));
    return;
  }
  show(result.structuredContent);
};

let resizeFrame = 0;
let lastWidth = 0;
new ResizeObserver(() => {
  if (!summary || document.body.clientWidth === lastWidth) return;
  lastWidth = document.body.clientWidth;
  cancelAnimationFrame(resizeFrame);
  const chart = content.querySelector('.chart');
  if (chart) resizeFrame = requestAnimationFrame(() => drawChart(chart, summary.series));
}).observe(document.body);

connect('ggcheckout-sales-dashboard').then(renderRanges).catch((error) => {
  content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error' }, `Sem conexão com o app: ${error.message}`));
});
