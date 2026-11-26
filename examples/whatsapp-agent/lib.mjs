// The pure parts of poll.mjs (no network, no process, no clock of its own), so they can be tested.

import { createHash } from 'node:crypto';

export function parseWindow(text) {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(text);
  if (!match) throw new Error(`AGENT_HOURS must look like 08:00-20:00, got ${text}`);
  const [, h1, m1, h2, m2] = match.map(Number);
  return { start: h1 * 60 + m1, end: h2 * 60 + m2 };
}

export function parseDays(text) {
  const set = new Set();
  for (const part of text.split(',')) {
    const [from, to = from] = part.split('-').map(Number);
    if (!(from >= 1 && to <= 7 && from <= to)) throw new Error(`AGENT_DAYS must use 1 (Monday) to 7, got ${text}`);
    for (let day = from; day <= to; day++) set.add(day);
  }
  return set;
}

const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Is `now` inside the answering window? `hours` and `days` come from parseWindow and parseDays. */
export function insideWindow({ now = new Date(), tz, hours, days }) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const overnight = hours.start > hours.end;
  const inHours = overnight ? minute >= hours.start || minute < hours.end : minute >= hours.start && minute < hours.end;
  // Past midnight in an overnight window the shift belongs to the day it started.
  const day = overnight && minute < hours.end ? ((WEEKDAY[parts.weekday] + 5) % 7) + 1 : WEEKDAY[parts.weekday];
  return inHours && days.has(day);
}

/** Same answered message, same id: a rerun after a crash or a timeout never sends the reply twice. */
export function clientMessageId(contactKey, inboundMessageId) {
  return createHash('sha256').update(`${contactKey}:${inboundMessageId}`).digest('hex').slice(0, 40);
}

/** pendingSince and lastText change when the contact writes again; until then the same state is not run again. */
export function fingerprintOf(item) {
  return `${item.contactKey}|${item.pendingSince}|${item.lastText ?? ''}`;
}

/** A short stable id for the logs: the log never carries a phone number or what the buyer wrote. */
export function logId(fingerprint) {
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 8);
}

/**
 * What happened to each conversation state (its fingerprint). A run that ends well, or a state given
 * up after `maxAttempts` failed runs, is not run again until the contact writes again (a new
 * fingerprint). A failed run waits `backoffMs` before its next try, and only that conversation waits.
 */
export function createAttemptTracker({ maxAttempts = 3, backoffMs = 5 * 60 * 1000, capacity = 2000 } = {}) {
  const states = new Map();

  const touch = (fingerprint, state) => {
    states.delete(fingerprint);
    states.set(fingerprint, state);
    if (states.size > capacity) states.delete(states.keys().next().value);
  };

  return {
    /** Should a run start now for this state? */
    shouldRun(fingerprint, now = Date.now()) {
      const state = states.get(fingerprint);
      if (!state) return true;
      return !state.done && !state.givenUp && now >= state.nextTryAt;
    },
    succeeded(fingerprint) {
      touch(fingerprint, { attempts: states.get(fingerprint)?.attempts ?? 0, done: true });
    },
    /** Records a failed run and says whether this state is now given up. */
    failed(fingerprint, now = Date.now()) {
      const attempts = (states.get(fingerprint)?.attempts ?? 0) + 1;
      const givenUp = attempts >= maxAttempts;
      touch(fingerprint, { attempts, givenUp, nextTryAt: now + backoffMs });
      return { attempts, givenUp };
    },
  };
}

/**
 * The ggcheckout-mcp version the MCP config template pins (`ggcheckout-mcp@x.y.z` in the server's
 * args). The script sends it as its own User-Agent, so the API refuses the script exactly when it
 * refuses the pinned server. A template without an exact pin is an error: `@latest` would change the
 * tools under the prompt without anyone reading the release.
 */
export function pinnedMcpVersion(template, serverName) {
  const args = template?.mcpServers?.[serverName]?.args ?? [];
  for (const arg of args) {
    const pin = /^ggcheckout-mcp@(\d+\.\d+\.\d+)$/.exec(arg);
    if (pin) return pin[1];
  }
  throw new Error(`the MCP config template must pin ggcheckout-mcp@<x.y.z> in the args of "${serverName}"`);
}

/** The API refused the pinned MCP as below its minimum version (`400 GGCHECKOUT_MCP_OUTDATED`): every call will be refused. */
export function isOutdatedMcpRefusal(status, body) {
  return status === 400 && body?.code === 'GGCHECKOUT_MCP_OUTDATED';
}

/** Replaces `${NAME}` in every string of the MCP config template with the run's values; an unknown name is an error. */
export function fillMcpConfig(template, values) {
  const fill = (node) => {
    if (typeof node === 'string') {
      return node.replace(/\$\{([A-Z_]+)\}/g, (_, name) => {
        if (!(name in values)) throw new Error(`the MCP config template uses \${${name}}, which has no value`);
        return values[name];
      });
    }
    if (Array.isArray(node)) return node.map(fill);
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, fill(v)]));
    return node;
  };
  return fill(template);
}

/**
 * The prompt of one run: the contact key and the reply id, and for a scheduled task its kind and the
 * ids it is about. Never what the buyer wrote.
 */
export function buildTask({ contactKey, clientMessageId: id, task = null }) {
  if (!task) {
    return 'Answer the pending WhatsApp conversation of this run, under your rules. Read it first.\n'
      + `contactKey: ${contactKey}, clientMessageId: ${id}`;
  }
  return 'Write the scheduled message of this run, under your rules for scheduled tasks. Read the conversation first.\n'
    + `contactKey: ${contactKey}, clientMessageId: ${id}, task: ${task.kind}, `
    + `paymentId: ${task.paymentId ?? 'none'}, productId: ${task.productId ?? 'none'}`;
}

/** The kinds of task the core schedules (`AgentTask.kind` in the core's whatsapp/agent v2 contract). */
export const TASK_KINDS = Object.freeze(['recovery', 'recovery_followup', 'welcome', 'upsell']);

const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TASK_CONTACT = /^[1-9][0-9]{7,14}$/;
/** A payment or product id goes into the run's prompt: only id characters, as the agent tools accept them. */
const TASK_REF = /^[A-Za-z0-9_-]{1,128}$/;

const isRunnableTask = (task) => Boolean(task)
  && TASK_ID.test(task.id) && TASK_KINDS.includes(task.kind) && TASK_CONTACT.test(task.contactKey)
  && (task.paymentId === null || TASK_REF.test(task.paymentId))
  && (task.productId === null || TASK_REF.test(task.productId));

/** The tasks of a pending page that can start a run; one in an unknown shape is skipped, never run. */
export function dueTasks(page) {
  return Array.isArray(page?.tasks) ? page.tasks.filter(isRunnableTask) : [];
}

/** A task runs until it ends well or is given up: its id is its whole state. */
export function taskFingerprint(task) {
  return `task|${task.id}`;
}

/** Same task, same id: a rerun after a crash or a timeout never sends the task's message twice. */
export function taskClientMessageId(taskId) {
  return createHash('sha256').update(`task:${taskId}`).digest('hex').slice(0, 40);
}

/**
 * The stdio of a run: stdout and stderr piped to the script, never inherited, so nothing the run prints
 * (the model's answer, a tool input) reaches the seller's terminal or log.
 */
export const RUN_STDIO = Object.freeze(['ignore', 'pipe', 'pipe']);

const TOKEN_FIELDS = [
  ['in', 'input_tokens'], ['out', 'output_tokens'], ['cacheRead', 'cache_read_input_tokens'], ['cacheWrite', 'cache_creation_input_tokens'],
];

/**
 * One log line from the `--output-format json` result of a run: outcome, counts, duration and cost.
 * The result carries the model's final text and `permission_denials` carries tool inputs, both with
 * what the buyer wrote: only their size or count goes to the log, never their content.
 */
export function summarizeRun(stdout) {
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    return `output not JSON (${Buffer.byteLength(stdout)} bytes)`;
  }
  if (!result || typeof result !== 'object' || result.type !== 'result') return `unexpected output (${Buffer.byteLength(stdout)} bytes)`;
  const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : '?');
  const usage = result.usage && typeof result.usage === 'object' ? result.usage : {};
  const parts = [
    `outcome=${typeof result.subtype === 'string' && /^[a-z_]{1,40}$/.test(result.subtype) ? result.subtype : '?'}`,
    `error=${result.is_error === true}`,
    `turns=${number(result.num_turns)}`,
    `durationMs=${number(result.duration_ms)}`,
    ...TOKEN_FIELDS.map(([label, field]) => `${label}=${number(usage[field])}`),
    `costUsd=${typeof result.total_cost_usd === 'number' ? result.total_cost_usd.toFixed(4) : '?'}`,
    `denials=${Array.isArray(result.permission_denials) ? result.permission_denials.length : 0}`,
  ];
  return parts.join(' ');
}

/**
 * The claude flags of one run. Only the agent tools exist for the model: no built-in tool, no other
 * MCP server, no settings, hooks or CLAUDE.md of the seller, no skills, nobody to approve a prompt.
 */
export function buildClaudeArgs({ task, rules, mcpConfigPath, serverName, toolNames }) {
  return [
    '-p', task,
    '--append-system-prompt', rules,
    '--mcp-config', mcpConfigPath,
    '--strict-mcp-config',
    '--tools', '',
    '--allowedTools', toolNames.map((name) => `mcp__${serverName}__${name}`).join(','),
    '--permission-mode', 'dontAsk',
    '--permission-prompts', 'none',
    '--setting-sources', '',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--output-format', 'json',
  ];
}
