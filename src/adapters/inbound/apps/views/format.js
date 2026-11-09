// Every amount these views receive is integer cents of BRL (the dashboard counters, the billing
// routes and the payments API alike), so formatting starts from cents.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});
const int = new Intl.NumberFormat('pt-BR');
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export function formatCents(cents) {
  return brl.format((cents ?? 0) / 100);
}

/** Axis labels: R$ 12,5 mil instead of R$ 12.500,00. */
export function formatCentsCompact(cents) {
  return brlCompact.format((cents ?? 0) / 100);
}

export function formatInt(n) {
  return int.format(n ?? 0);
}

/** A ratio in 0..1; null when there is nothing to divide. */
export function formatPercent(ratio) {
  return ratio == null ? '–' : pct.format(ratio);
}

/** Small element factory: text always goes in as textContent, never as HTML. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
