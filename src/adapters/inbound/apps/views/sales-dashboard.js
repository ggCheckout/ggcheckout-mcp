// Sales panel view, attached to get_dashboard_charts. The tool result draws it; the period buttons
// call the same tool again through the host.

const SVG_NS = 'http://www.w3.org/2000/svg';
const content = document.getElementById('content');
const rangesBox = document.getElementById('ranges');
const title = document.getElementById('title');

let range = 'week';
let timezone;
let summary = null;

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

const SERIES_TITLE = { hourly: 'Faturamento por hora', daily: 'Faturamento por dia', weekly: 'Faturamento por semana', monthly: 'Faturamento por mês' };

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
    const data = await callTool('get_dashboard_charts', { range: next, ...(timezone ? { tz: timezone } : {}) });
    show(data);
  } catch (error) {
    range = previous;
    renderRanges();
    content.removeAttribute('aria-busy');
    content.prepend(el('p', { class: 'state', 'data-tone': 'error', role: 'alert' }, `Não deu para trocar o período: ${error.message}`));
  }
}

function metric(label, value, lead = false) {
  return el('div', { class: lead ? 'metric lead' : 'metric' },
    el('p', { class: 'm-label' }, label),
    el('p', { class: 'm-value display num' }, value));
}

function barRow(name, value, share) {
  return el('div', { class: 'bar-row' },
    el('span', { class: 'name', title: name }, name),
    el('span', { class: 'num muted' }, value),
    el('div', { class: 'track' }, el('div', { class: 'fill', style: `width: ${Math.max(0, Math.min(1, share)) * 100}%` })));
}

function panel(heading, rows, emptyText) {
  return el('section', { class: 'surface' }, el('h3', { class: 'card-title display' }, heading), rows.length ? rows : el('p', { class: 'empty-panel' }, emptyText));
}

function drawChart(box, series) {
  const width = box.clientWidth;
  const height = box.clientHeight;
  if (!width || !series.length) return;
  const pad = { top: 8, right: 8, bottom: 22, left: 58 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const scale = niceScale(Math.max(...series.map((p) => p.revenue)));
  const x = (i) => pad.left + (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);
  const y = (v) => pad.top + h - (v / scale.max) * h;

  const root = svg('svg', { width, height, role: 'img', 'aria-label': `${SERIES_TITLE[summary.granularity] ?? 'Faturamento'}: total ${formatCents(summary.revenue)}` });
  const fill = svg('linearGradient', { id: 'area-fill', x1: 0, y1: 0, x2: 0, y2: 1 });
  fill.append(svg('stop', { offset: '0%', 'stop-opacity': 0.32 }), svg('stop', { offset: '100%', 'stop-opacity': 0.02 }));
  const defs = svg('defs');
  defs.append(fill);
  root.append(defs);
  for (const tick of scale.ticks) {
    root.append(svg('line', { class: 'grid', x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick) }));
    const label = svg('text', { class: 'axis num', x: pad.left - 8, y: y(tick) + 4, 'text-anchor': 'end' });
    label.textContent = formatCentsCompact(tick);
    root.append(label);
  }
  const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(w / 72))));
  series.forEach((p, i) => {
    if (i % every !== 0 && i !== series.length - 1) return;
    if (i === series.length - 1 && i % every !== 0 && (series.length - 1) % every < every / 2) return;
    const label = svg('text', { class: 'axis', x: x(i), y: height - 4, 'text-anchor': i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle' });
    label.textContent = p.label;
    root.append(label);
  });

  const points = series.map((p, i) => `${x(i)},${y(p.revenue)}`);
  root.append(svg('path', { class: 'area', d: `M${x(0)},${y(0)} L${points.join(' L')} L${x(series.length - 1)},${y(0)} Z` }));
  root.append(svg('path', { class: 'line', d: `M${points.join(' L')}` }));

  const cross = svg('line', { class: 'cross', y1: pad.top, y2: pad.top + h, visibility: 'hidden' });
  const dot = svg('circle', { class: 'dot', r: 4.5, visibility: 'hidden' });
  root.append(cross, dot);
  const tip = el('div', { class: 'tip', hidden: true });

  const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  const hit = svg('rect', { x: pad.left - 6, y: 0, width: w + 12, height, fill: 'transparent' });
  hit.addEventListener('pointermove', (event) => {
    const box = root.getBoundingClientRect();
    const rel = (event.clientX - box.left - pad.left) / w;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(rel * (series.length - 1))));
    const p = series[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(p.revenue)); dot.setAttribute('visibility', 'visible');
    tip.replaceChildren(
      el('span', { class: 'muted' }, p.label),
      el('strong', { class: 'num' }, formatCents(p.revenue)),
      el('span', { class: 'num muted' }, `${formatInt(p.sales)} ${p.sales === 1 ? 'venda' : 'vendas'}`));
    tip.hidden = false;
    const left = Math.min(Math.max(x(i) - tip.offsetWidth / 2, 0), width - tip.offsetWidth);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, y(p.revenue) - tip.offsetHeight - 12)}px`;
  });
  hit.addEventListener('pointerleave', hide);
  root.append(hit);
  box.replaceChildren(root, tip);
}

function dataTable(series) {
  return el('details', {},
    el('summary', {}, 'Ver dados em tabela'),
    el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'Período'), el('th', {}, 'Vendas'), el('th', {}, 'Faturamento'))),
      el('tbody', {}, series.map((p) => el('tr', {},
        el('td', {}, p.label), el('td', { class: 'num' }, formatInt(p.sales)), el('td', { class: 'num' }, formatCents(p.revenue)))))));
}

function render() {
  const s = summary;
  title.textContent = `Vendas · ${rangeLabel(s.period ?? range)}`;
  const chartBox = el('div', { class: 'chart' });
  const maxProduct = Math.max(1, ...s.topProducts.map((p) => p.count));
  const maxState = Math.max(1, ...s.topStates.map((st) => st.revenue));

  content.replaceChildren(
    el('div', { class: 'metrics' },
      metric('Faturamento', formatCents(s.revenue), true),
      metric('Vendas', formatInt(s.sales)),
      metric('Ticket médio', formatCents(s.averageTicket)),
      metric('Conversão', formatPercent(s.conversion))),
    el('section', { class: 'surface chart-card' },
      el('h3', { class: 'card-title display' }, SERIES_TITLE[s.granularity] ?? 'Faturamento'),
      chartBox),
    el('div', { class: 'panels' },
      panel('Aprovação por método', s.approval.map((m) => barRow(m.label, `${formatPercent(m.rate)} · ${formatInt(m.approved)}/${formatInt(m.total)}`, m.rate ?? 0)), 'Nenhuma tentativa no período'),
      panel('Mais vendidos', s.topProducts.map((p) => barRow(p.name, formatInt(p.count), p.count / maxProduct)), 'Nenhuma venda no período'),
      panel('Estados', s.topStates.map((st) => barRow(st.state, formatCents(st.revenue), st.revenue / maxState)), 'Sem estado informado')),
    el('div', { class: 'foot' },
      el('span', { class: 'muted num' }, `Reembolsos ${formatInt(s.refunds.refund)} · Chargebacks ${formatInt(s.refunds.chargeback)} · MED ${formatInt(s.refunds.med)}`),
      timezone ? el('span', { class: 'faint' }, `Fuso ${timezone}`) : null),
    dataTable(s.series));
  content.removeAttribute('aria-busy');
  drawChart(chartBox, s.series);
}

function show(data) {
  const next = summarizeDashboard(data);
  if (!next) {
    content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error' }, 'A resposta não trouxe dados do painel.'));
    return;
  }
  summary = next;
  if (data.period) range = data.period;
  if (data.timezone) timezone = data.timezone;
  renderRanges();
  render();
  updateModelContext(`Painel de vendas aberto em "${rangeLabel(range)}": faturamento ${formatCents(summary.revenue)}, ${summary.sales} vendas.`);
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
  resizeFrame = requestAnimationFrame(() => drawChart(content.querySelector('.chart'), summary.series));
}).observe(document.body);

connect('ggcheckout-sales-dashboard').then(renderRanges).catch((error) => {
  content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error' }, `Sem conexão com o app: ${error.message}`));
});
