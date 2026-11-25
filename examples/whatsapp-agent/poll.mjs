#!/usr/bin/env node
// Polls the WhatsApp agent routes of GG Checkout and runs `claude -p`, one run per waiting conversation,
// only when the store is inside its answering hours. Node >= 18, no dependencies.
//
// Environment:
//   GGCHECKOUT_AGENT_KEY   the assistant key (ggck_agent_ + 64 hex), shown once when the seller turns the assistant on
//   GGCHECKOUT_API_URL     default https://ggcheckout.app; the pilot runs only on https://qa.ggcheckout.app (production answers 404 AGENT_UNAVAILABLE)
//   AGENT_SELLER_NAME      the store name the assistant speaks for (fills {{SELLER_NAME}} in prompt.md)
//   AGENT_HOURS            answering window, local time, default 08:00-20:00 (22:00-06:00 crosses midnight)
//   AGENT_DAYS             ISO weekdays, 1 = Monday, default 1-7 (e.g. 1-5 or 1,2,3,4,5,6)
//   AGENT_TZ               default America/Sao_Paulo
//   AGENT_POLL_SECONDS     default 15
//   AGENT_RUN_TIMEOUT_SECONDS  default 600, a claude run is killed after it
//   CLAUDE_BIN             default claude
//   AGENT_MAX_ATTEMPTS     failed runs of one conversation state before it is given up, default 3

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildClaudeArgs, buildTask, clientMessageId, createAttemptTracker, fillMcpConfig, fingerprintOf, insideWindow,
  isOutdatedMcpRefusal, logId, parseDays, parseWindow, pinnedMcpVersion,
} from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const KEY = (process.env.GGCHECKOUT_AGENT_KEY ?? '').trim();
const API_URL = (process.env.GGCHECKOUT_API_URL || 'https://ggcheckout.app').replace(/\/+$/, '');
const SELLER_NAME = process.env.AGENT_SELLER_NAME || 'the store';
const HOURS = process.env.AGENT_HOURS || '08:00-20:00';
const DAYS = process.env.AGENT_DAYS || '1-7';
const TZ = process.env.AGENT_TZ || 'America/Sao_Paulo';
const POLL_MS = wholeNumber('AGENT_POLL_SECONDS', 15) * 1000;
const RUN_TIMEOUT_MS = wholeNumber('AGENT_RUN_TIMEOUT_SECONDS', 600) * 1000;
const MAX_ATTEMPTS = wholeNumber('AGENT_MAX_ATTEMPTS', 3);
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
/** The core caps the pending page at 20. */
const PENDING_LIMIT = 20;

/** A whole number (seconds or a count), or the default: "15s" would make the loop spin and spend the key's budget. */
function wholeNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    console.error(`${name} must be a whole number, got ${raw}`);
    process.exit(1);
  }
  return Number(raw);
}

const SERVER = 'ggcheckout';
// The assistant reads strangers' messages: the model gets these tools and nothing else. The pending list is not one of them:
// this script reads it, and each run is pinned to one conversation (GGCHECKOUT_AGENT_CONTACT in the MCP server's environment).
const TOOLS = [
  'read_whatsapp_conversation', 'send_whatsapp_reply', 'hold_whatsapp_conversation', 'find_contact_purchases',
  'resend_delivery', 'resend_delivery_by_email', 'get_payment_recovery_link', 'list_purchase_offers', 'create_offer_link',
];

if (!/^ggck_agent_[a-f0-9]{64}$/.test(KEY)) {
  console.error('GGCHECKOUT_AGENT_KEY must be the assistant key: ggck_agent_ followed by 64 lowercase hex characters.');
  process.exit(1);
}

const rules = readFileSync(join(here, 'prompt.md'), 'utf-8').replaceAll('{{SELLER_NAME}}', SELLER_NAME);
const mcpTemplate = JSON.parse(readFileSync(join(here, '.mcp.json'), 'utf-8'));
const MCP_VERSION = pinnedMcpVersion(mcpTemplate, SERVER);
const hours = parseWindow(HOURS);
const days = parseDays(DAYS);
const tracker = createAttemptTracker({ maxAttempts: MAX_ATTEMPTS });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.error(`${new Date().toISOString()} ${message}`);

class HttpError extends Error {
  constructor(status, retryAfter, outdated = false) {
    super(`HTTP ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
    this.outdated = outdated;
    this.unavailable = false;
  }
}

async function api(path) {
  const res = await fetch(`${API_URL}/api/whatsapp/agent${path}`, {
    // The pinned server's User-Agent: the API refuses this script when it refuses that server.
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'User-Agent': `ggcheckout-mcp/${MCP_VERSION}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = res.status === 400 ? await res.json().catch(() => null) : null;
    throw new HttpError(res.status, Number(res.headers.get('retry-after')) || undefined, isOutdatedMcpRefusal(res.status, body));
  }
  return res.json();
}

/**
 * One `claude -p` run for one conversation. The MCP config is a temp file (0600, in its own 0700
 * directory) with this run's contact in the server's environment, deleted when the run ends; the
 * claude process does not get the assistant key in its own environment. Resolves true on exit code 0.
 */
function runClaude({ contactKey, clientMessageId: replyId }) {
  const dir = mkdtempSync(join(tmpdir(), 'ggcheckout-agent-'));
  const mcpConfigPath = join(dir, 'mcp.json');
  const config = fillMcpConfig(mcpTemplate, {
    GGCHECKOUT_AGENT_KEY: KEY, GGCHECKOUT_API_URL: API_URL, GGCHECKOUT_AGENT_CONTACT: contactKey,
  });
  writeFileSync(mcpConfigPath, JSON.stringify(config), { mode: 0o600 });
  const args = buildClaudeArgs({
    task: buildTask({ contactKey, clientMessageId: replyId }), rules, mcpConfigPath, serverName: SERVER, toolNames: TOOLS,
  });
  const { GGCHECKOUT_AGENT_KEY: _key, ...env } = process.env;
  return new Promise((resolve) => {
    // cwd is the empty temp directory: no project files or CLAUDE.md of this repo for the run to find.
    const child = spawn(CLAUDE_BIN, args, { cwd: dir, env, stdio: ['ignore', 'inherit', 'inherit'] });
    const done = (ok) => { clearTimeout(timer); rmSync(dir, { recursive: true, force: true }); resolve(ok); };
    const timer = setTimeout(() => child.kill('SIGTERM'), RUN_TIMEOUT_MS);
    child.on('error', (error) => { log(`could not start ${CLAUDE_BIN}: ${error.message}`); done(false); });
    child.on('exit', (code) => done(code === 0));
  });
}

/** True when the error ends the whole pass (key refused, MCP too old, API asked to slow down): anything else only skips one conversation. */
const endsThePass = (error) => error instanceof HttpError && (error.outdated || [401, 429, 503].includes(error.status));

/** One pass: every pending conversation that changed since its last run gets its own run. */
async function pass() {
  let list;
  try {
    list = await api(`/conversations?limit=${PENDING_LIMIT}`);
  } catch (error) {
    // 404 on the pending list: this API has no assistant (production answers 404 AGENT_UNAVAILABLE, an older one has no route).
    if (error instanceof HttpError && error.status === 404) error.unavailable = true;
    throw error;
  }
  const { items = [] } = list;
  for (const item of items) {
    // A pass of many runs can cross the end of the window: check it again before each one.
    if (!insideWindow({ tz: TZ, hours, days })) return;
    const fingerprint = fingerprintOf(item);
    if (!tracker.shouldRun(fingerprint)) continue;
    const id = logId(fingerprint);
    try {
      const page = await api(`/conversations/${encodeURIComponent(item.contactKey)}/messages?limit=20`);
      const lastIn = (page.items ?? []).find((message) => message.dir === 'in');
      if (!lastIn) continue;
      log(`running claude for conversation ${id}`);
      const ok = await runClaude({ contactKey: item.contactKey, clientMessageId: clientMessageId(item.contactKey, lastIn.id) });
      if (ok) {
        tracker.succeeded(fingerprint);
        continue;
      }
      const { attempts, givenUp } = tracker.failed(fingerprint);
      log(givenUp ? `conversation ${id}: run failed ${attempts} times, giving up until the contact writes again`
        : `conversation ${id}: run failed (${attempts}/${MAX_ATTEMPTS}), trying again later`);
    } catch (error) {
      if (endsThePass(error)) throw error;
      log(`conversation ${id}: ${error.message}`);
    }
  }
}

log(`polling ${API_URL} every ${POLL_MS / 1000}s, answering ${HOURS} on days ${DAYS} (${TZ})`);

for (;;) {
  if (!insideWindow({ tz: TZ, hours, days })) {
    await sleep(POLL_MS);
    continue;
  }
  try {
    await pass();
  } catch (error) {
    if (error instanceof HttpError && error.outdated) {
      log(`the API refuses ggcheckout-mcp ${MCP_VERSION} as too old: raise the pin in .mcp.json (see the README). Stopping.`);
      process.exit(2);
    }
    if (error instanceof HttpError && error.unavailable) {
      log(`${API_URL} has no WhatsApp assistant (404 on the pending list): the pilot runs only on https://qa.ggcheckout.app. Set GGCHECKOUT_API_URL to it. Stopping.`);
      process.exit(2);
    }
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
