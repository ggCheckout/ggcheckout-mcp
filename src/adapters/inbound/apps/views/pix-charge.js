// PIX view: QR, copy-and-paste code, time left, and the status kept fresh by polling the tool that
// reads it (through the host) until the PIX is paid, expires or the view goes away.

const content = document.getElementById('content');

const POLL_MS = 5000;
// A PIX paid in the last seconds can take a moment to show, so polling outlives the expiry a little.
const GRACE_AFTER_EXPIRY_MS = 120_000;
const POLL_LIMIT_MS = 30 * 60_000;

const STATUS_TEXT = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  expired: 'Expirado',
  canceled: 'Cancelado',
  failed: 'Falhou',
};

let charge = null;
let toolArgs = {};
let pollTimer = 0;
let tickTimer = 0;
let pollStartedAt = 0;
let stopped = false;

function stop() {
  stopped = true;
  clearTimeout(pollTimer);
  clearInterval(tickTimer);
}

const checkIcon = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('width', '40');
  icon.setAttribute('height', '40');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  return icon;
};

async function copyCode(button, field) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(charge.code);
  } catch {
    // No clipboard permission in this sandbox: select the text so Ctrl/Cmd+C finishes the job.
    field.focus();
    field.select();
    if (!document.execCommand?.('copy')) {
      button.textContent = 'Selecionado, use Ctrl+C';
      setTimeout(() => { button.textContent = original; }, 2400);
      return;
    }
  }
  button.textContent = 'Código copiado';
  setTimeout(() => { button.textContent = original; }, 2000);
}

function render() {
  const c = charge;
  if (c.status === 'none') {
    content.replaceChildren(el('p', { class: 'state' }, 'Nenhuma recarga em aberto.'));
    return;
  }
  if (c.status === 'requested') {
    const how = c.method === 'card' ? 'no cartão salvo' : c.method === 'credits' ? 'com os créditos' : '';
    content.replaceChildren(el('div', { class: 'done' }, checkIcon(),
      el('div', {}, el('h2', {}, 'Pagamento enviado'), el('p', { class: 'note muted' }, `Fatura ${c.id} ${how}`.trim()))));
    return;
  }
  if (c.status === 'paid') {
    content.replaceChildren(el('div', { class: 'done', role: 'status' }, checkIcon(),
      el('div', {},
        el('h2', {}, 'Pagamento confirmado'),
        el('p', { class: 'note muted num' }, [c.amountCents != null ? formatCents(c.amountCents) : null, c.title].filter(Boolean).join(' · ')))));
    return;
  }

  const open = c.status === 'pending';
  const remaining = c.expiresAt ? formatRemaining(c.expiresAt) : null;
  const field = el('input', { class: 'code', value: c.code ?? '', readonly: true, 'aria-label': 'Código PIX copia e cola' });

  content.replaceChildren(el('div', { class: 'pix' },
    el('div', { class: 'qr', 'data-dim': !open },
      c.qrSrc ? el('img', { src: c.qrSrc, alt: 'QR code do PIX' }) : el('span', { class: 'faint note' }, 'QR indisponível')),
    el('div', { class: 'info' },
      el('div', {},
        el('p', { class: 'eyebrow' }, c.title),
        c.amountCents != null ? el('p', { class: 'amount num' }, formatCents(c.amountCents)) : null,
        c.description ? el('p', { class: 'note muted' }, c.description) : null),
      el('div', { class: 'meta', role: 'status' },
        el('span', { class: 'pill', 'data-status': c.status }, STATUS_TEXT[c.status] ?? c.status),
        open && remaining ? el('span', { class: 'muted num', id: 'remaining' }, `expira em ${remaining}`) : null,
        c.livemode ? null : el('span', { class: 'badge' }, 'MODO TESTE')),
      c.code && open ? field : null,
      c.code && open ? el('button', { class: 'copy', type: 'button', onclick: (e) => copyCode(e.currentTarget, field) }, 'Copiar código PIX') : null,
      open && !bridge.capabilities.serverTools
        ? el('p', { class: 'note faint' }, 'Peça no chat para conferir se o PIX foi pago.')
        : null)));
}

function setStatus(status) {
  if (!status || status === charge.status) return;
  charge = { ...charge, status };
  render();
  if (FINAL_STATUSES.has(status)) {
    stop();
    const what = `${charge.title}${charge.id ? ` ${charge.id}` : ''}`;
    updateModelContext(`${what}: ${STATUS_TEXT[status].toLowerCase()} (visto na tela do PIX).`);
  }
}

async function poll() {
  if (stopped || !charge?.poll) return;
  const expiredFor = charge.expiresAt ? Date.now() - Date.parse(charge.expiresAt) : -1;
  if (expiredFor > GRACE_AFTER_EXPIRY_MS || Date.now() - pollStartedAt > POLL_LIMIT_MS) {
    if (expiredFor > 0) setStatus('expired');
    stop();
    return;
  }
  if (!document.hidden) {
    try {
      setStatus(polledStatus(charge, await callTool(charge.poll.tool, charge.poll.args)));
    } catch {
      // A failed read is not a status: try again on the next tick.
    }
  }
  if (!stopped) pollTimer = setTimeout(poll, POLL_MS);
}

function start() {
  render();
  if (charge.status !== 'pending') return;
  tickTimer = setInterval(() => {
    const label = document.getElementById('remaining');
    const remaining = charge.expiresAt ? formatRemaining(charge.expiresAt) : null;
    if (label && remaining) label.textContent = `expira em ${remaining}`;
    else if (label) label.textContent = 'prazo encerrado, conferindo';
  }, 1000);
  if (bridge.capabilities.serverTools && charge.poll) {
    pollStartedAt = Date.now();
    pollTimer = setTimeout(poll, POLL_MS);
  }
}

bridge.onToolInput = (args) => { toolArgs = args ?? {}; };
bridge.onToolResult = (result) => {
  if (result.isError) {
    content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error', role: 'alert' }, result.content?.[0]?.text ?? 'Erro ao gerar o PIX.'));
    return;
  }
  charge = normalizePix(result.structuredContent, toolArgs);
  if (!charge) {
    content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error' }, 'A resposta não trouxe um PIX.'));
    return;
  }
  start();
};
bridge.onTeardown = stop;

connect('ggcheckout-pix-charge').catch((error) => {
  content.replaceChildren(el('p', { class: 'state', 'data-tone': 'error' }, `Sem conexão com o app: ${error.message}`));
});
