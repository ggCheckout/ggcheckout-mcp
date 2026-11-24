#!/usr/bin/env node
// Polls the WhatsApp agent routes of GG Checkout and runs `claude -p` only when a conversation is
// waiting and the store is inside its answering hours. Node >= 18, no dependencies.
//
// Environment:
//   GGCHECKOUT_AGENT_KEY   the assistant key (ggck_agent_ + 64 hex), shown once when the seller turns the assistant on
//   GGCHECKOUT_API_URL     default https://ggcheckout.app
//   AGENT_SELLER_NAME      the store name the assistant speaks for (fills {{SELLER_NAME}} in prompt.md)
//   AGENT_HOURS            answering window, local time, default 08:00-20:00 (22:00-06:00 crosses midnight)
//   AGENT_DAYS             ISO weekdays, 1 = Monday, default 1-7 (e.g. 1-5 or 1,2,3,4,5,6)
//   AGENT_TZ               default America/Sao_Paulo
//   AGENT_POLL_SECONDS     default 15
//   AGENT_RUN_TIMEOUT_SECONDS  default 600, a claude run is killed after it
//   CLAUDE_BIN             default claude

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const KEY = (process.env.GGCHECKOUT_AGENT_KEY ?? '').trim();
const API_URL = (process.env.GGCHECKOUT_API_URL || 'https://ggcheckout.app').replace(/\/+$/, '');
const SELLER_NAME = process.env.AGENT_SELLER_NAME || 'the store';
const HOURS = process.env.AGENT_HOURS || '08:00-20:00';
const DAYS = process.env.AGENT_DAYS || '1-7';
const TZ = process.env.AGENT_TZ || 'America/Sao_Paulo';
const POLL_MS = seconds('AGENT_POLL_SECONDS', 15) * 1000;
const RUN_TIMEOUT_MS = seconds('AGENT_RUN_TIMEOUT_SECONDS', 600) * 1000;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const FAILED_RUN_BACKOFF_MS = 5 * 60 * 1000;

/** A whole number of seconds, or the default: "15s" would make the loop spin and spend the key's budget. */
function seconds(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    console.error(`${name} must be a whole number of seconds, got ${raw}`);
    process.exit(1);
  }
  return Number(raw);
}

const SERVER = 'ggcheckout';
const TOOLS = [
  'list_pending_whatsapp_conversations', 'read_whatsapp_conversation', 'send_whatsapp_reply',
  'hold_whatsapp_conversation', 'find_contact_purchases', 'resend_delivery', 'get_payment_recovery_link',
  'list_purchase_offers', 'create_offer_link',
].map((name) => `mcp__${SERVER}__${name}`);
// The assistant reads strangers' messages: it gets the agent tools and nothing that touches this machine.
const DENIED = ['Bash', 'Edit', 'Write', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task'];

if (!/^ggck_agent_[a-f0-9]{64}$/.test(KEY)) {
  console.error('GGCHECKOUT_AGENT_KEY must be the assistant key: ggck_agent_ followed by 64 lowercase hex characters.');
  process.exit(1);
}

const rules = readFileSync(join(here, 'prompt.md'), 'utf-8').replaceAll('{{SELLER_NAME}}', SELLER_NAME);
const hours = parseWindow(HOURS);
const days = parseDays(DAYS);

/** What was already handed to Claude, so a conversation it chose not to answer is not run again every poll. */
const seen = new Map();
const SEEN_MAX = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.error(`${new Date().toISOString()} ${message}`);

function parseWindow(text) {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(text);
  if (!match) throw new Error(`AGENT_HOURS must look like 08:00-20:00, got ${text}`);
  const [, h1, m1, h2, m2] = match.map(Number);
  return { start: h1 * 60 + m1, end: h2 * 60 + m2 };
}

function parseDays(text) {
  const set = new Set();
  for (const part of text.split(',')) {
    const [from, to = from] = part.split('-').map(Number);
    if (!(from >= 1 && to <= 7 && from <= to)) throw new Error(`AGENT_DAYS must use 1 (Monday) to 7, got ${text}`);
    for (let day = from; day <= to; day++) set.add(day);
  }
  return set;
}

const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function insideWindow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const overnight = hours.start > hours.end;
  const inHours = overnight ? minute >= hours.start || minute < hours.end : minute >= hours.start && minute < hours.end;
  // Past midnight in an overnight window the shift belongs to the day it started.
  const day = overnight && minute < hours.end ? ((WEEKDAY[parts.weekday] + 5) % 7) + 1 : WEEKDAY[parts.weekday];
  return inHours && days.has(day);
}

class HttpError extends Error {
  constructor(status, retryAfter) {
    super(`HTTP ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function api(path) {
  const res = await fetch(`${API_URL}/api/whatsapp/agent${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new HttpError(res.status, Number(res.headers.get('retry-after')) || undefined);
  return res.json();
}

/** Same answered message, same id: a rerun after a crash or a timeout never sends the reply twice. */
function clientMessageId(contactKey, inboundMessageId) {
  return createHash('sha256').update(`${contactKey}:${inboundMessageId}`).digest('hex').slice(0, 40);
}

function remember(key) {
  seen.set(key, Date.now());
  if (seen.size > SEEN_MAX) seen.delete(seen.keys().next().value);
}

/** The conversations Claude has not seen in this state yet, each with the id for its reply. */
async function freshConversations() {
  const { items = [] } = await api('/conversations?limit=50');
  const fresh = [];
  for (const item of items) {
    // pendingSince and lastText change when the contact writes again; until then the thread is not read again.
    const fingerprint = `${item.contactKey}|${item.pendingSince}|${item.lastText ?? ''}`;
    if (seen.has(fingerprint)) continue;
    const page = await api(`/conversations/${encodeURIComponent(item.contactKey)}/messages?limit=20`);
    const lastIn = (page.items ?? []).find((message) => message.dir === 'in');
    if (!lastIn) continue;
    fresh.push({ contactKey: item.contactKey, clientMessageId: clientMessageId(item.contactKey, lastIn.id), fingerprint });
  }
  return fresh;
}

function runClaude(conversations) {
  // Only keys and ids go in the prompt: what the contacts wrote reaches Claude through the tools, behind their notice.
  const task = 'Handle these pending WhatsApp conversations, one by one, under your rules. Read each one first.\n'
    + conversations.map((c) => `- contactKey: ${c.contactKey}, clientMessageId: ${c.clientMessageId}`).join('\n');
  const args = [
    '-p', task,
    '--append-system-prompt', rules,
    '--mcp-config', join(here, '.mcp.json'),
    '--strict-mcp-config',
    '--allowedTools', TOOLS.join(','),
    '--disallowedTools', DENIED.join(','),
    '--output-format', 'text',
  ];
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, args, { cwd: here, stdio: ['ignore', 'inherit', 'inherit'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), RUN_TIMEOUT_MS);
    child.on('error', (error) => { clearTimeout(timer); log(`could not start ${CLAUDE_BIN}: ${error.message}`); resolve(false); });
    child.on('exit', (code) => { clearTimeout(timer); resolve(code === 0); });
  });
}

log(`polling ${API_URL} every ${POLL_MS / 1000}s, answering ${HOURS} on days ${DAYS} (${TZ})`);

for (;;) {
  if (!insideWindow()) {
    await sleep(POLL_MS);
    continue;
  }
  try {
    const conversations = await freshConversations();
    if (conversations.length > 0) {
      log(`running claude for ${conversations.length} conversation(s)`);
      const ok = await runClaude(conversations);
      if (ok) for (const c of conversations) remember(c.fingerprint);
      else {
        log('claude run failed; waiting before trying again');
        await sleep(FAILED_RUN_BACKOFF_MS);
        continue;
      }
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      log('the assistant key was refused: the seller turned the assistant off or revoked the key. Stopping.');
      process.exit(2);
    }
    if (error instanceof HttpError && (error.status === 429 || error.status === 503)) {
      const wait = (error.retryAfter ?? 60) * 1000;
      log(`${error.status}: waiting ${wait / 1000}s as the API asked`);
      await sleep(wait);
      continue;
    }
    log(`poll failed: ${error.message}`);
  }
  await sleep(POLL_MS);
}
