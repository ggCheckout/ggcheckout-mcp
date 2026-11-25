import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  buildClaudeArgs, buildTask, clientMessageId, createAttemptTracker, fillMcpConfig, fingerprintOf, insideWindow,
  isOutdatedMcpRefusal, logId, parseDays, parseWindow, pinnedMcpVersion,
} from './lib.mjs';

const TZ = 'America/Sao_Paulo';
// Sao Paulo is UTC-3 all year since 2019.
const at = (iso) => new Date(`${iso}-03:00`);

describe('answering window', () => {
  const day = { tz: TZ, hours: parseWindow('08:00-20:00'), days: parseDays('1-5') };

  it('is open inside the hours on an allowed weekday', () => {
    expect(insideWindow({ ...day, now: at('2026-11-25T10:00:00') })).toBe(true); // Wednesday
  });

  it('is closed before, at the end and after the hours, and on a weekend', () => {
    expect(insideWindow({ ...day, now: at('2026-11-25T07:59:00') })).toBe(false);
    expect(insideWindow({ ...day, now: at('2026-11-25T20:00:00') })).toBe(false);
    expect(insideWindow({ ...day, now: at('2026-11-28T10:00:00') })).toBe(false); // Saturday
  });

  it('an overnight window past midnight belongs to the day it started', () => {
    const night = { tz: TZ, hours: parseWindow('22:00-06:00'), days: parseDays('1-5') };
    expect(insideWindow({ ...night, now: at('2026-11-27T23:00:00') })).toBe(true); // Friday night
    expect(insideWindow({ ...night, now: at('2026-11-28T02:00:00') })).toBe(true); // still Friday's shift
    expect(insideWindow({ ...night, now: at('2026-11-29T02:00:00') })).toBe(false); // Saturday's shift: not allowed
  });

  it('refuses a malformed window or day list', () => {
    expect(() => parseWindow('8-20')).toThrow(/AGENT_HOURS/);
    expect(() => parseDays('0-3')).toThrow(/AGENT_DAYS/);
    expect(() => parseDays('5-8')).toThrow(/AGENT_DAYS/);
    expect([...parseDays('1,3-4')]).toEqual([1, 3, 4]);
  });
});

describe('reply id and fingerprint', () => {
  it('the reply id is stable per contact and last incoming message, 40 hex', () => {
    const id = clientMessageId('553199998888', '1700-1');
    expect(id).toMatch(/^[a-f0-9]{40}$/);
    expect(clientMessageId('553199998888', '1700-1')).toBe(id);
    expect(clientMessageId('553199998888', '1700-2')).not.toBe(id);
    expect(clientMessageId('553188887777', '1700-1')).not.toBe(id);
  });

  it('the fingerprint changes when the contact writes again', () => {
    const a = fingerprintOf({ contactKey: 'k', pendingSince: 't1', lastText: 'oi' });
    expect(fingerprintOf({ contactKey: 'k', pendingSince: 't1', lastText: 'oi' })).toBe(a);
    expect(fingerprintOf({ contactKey: 'k', pendingSince: 't1', lastText: 'oi?' })).not.toBe(a);
    expect(fingerprintOf({ contactKey: 'k', pendingSince: 't1' })).toBe('k|t1|');
  });

  it('the log id carries neither the contact nor the text', () => {
    const id = logId(fingerprintOf({ contactKey: '553199998888', pendingSince: 't', lastText: 'meu cpf' }));
    expect(id).toMatch(/^[a-f0-9]{8}$/);
  });
});

describe('attempt tracker', () => {
  it('runs a new state, and never again after a success', () => {
    const tracker = createAttemptTracker();
    expect(tracker.shouldRun('a')).toBe(true);
    tracker.succeeded('a');
    expect(tracker.shouldRun('a', Date.now() + 1e9)).toBe(false);
  });

  it('a failed run waits its backoff, then is tried again', () => {
    const tracker = createAttemptTracker({ backoffMs: 1000 });
    expect(tracker.failed('a', 0)).toEqual({ attempts: 1, givenUp: false });
    expect(tracker.shouldRun('a', 999)).toBe(false);
    expect(tracker.shouldRun('a', 1000)).toBe(true);
  });

  it('gives up after three failed runs and stays given up', () => {
    const tracker = createAttemptTracker({ backoffMs: 10 });
    tracker.failed('a', 0);
    tracker.failed('a', 100);
    expect(tracker.failed('a', 200)).toEqual({ attempts: 3, givenUp: true });
    expect(tracker.shouldRun('a', 1e9)).toBe(false);
  });

  it('one failing conversation does not block another', () => {
    const tracker = createAttemptTracker();
    tracker.failed('bad', 0);
    expect(tracker.shouldRun('bad', 1)).toBe(false);
    expect(tracker.shouldRun('good', 1)).toBe(true);
  });

  it('a new fingerprint of the same contact starts over', () => {
    const tracker = createAttemptTracker({ maxAttempts: 1 });
    tracker.failed('k|t1|oi', 0);
    expect(tracker.shouldRun('k|t1|oi', 1e9)).toBe(false);
    expect(tracker.shouldRun('k|t2|oi again', 1e9)).toBe(true);
  });

  it('forgets the oldest state past its capacity', () => {
    const tracker = createAttemptTracker({ capacity: 2 });
    tracker.succeeded('a');
    tracker.succeeded('b');
    tracker.succeeded('c');
    expect(tracker.shouldRun('a')).toBe(true);
    expect(tracker.shouldRun('c')).toBe(false);
  });
});

describe('run setup', () => {
  const template = {
    mcpServers: { ggcheckout: { command: 'npx', args: ['-y', 'ggcheckout-mcp@0.7.0'], env: { GGCHECKOUT_AGENT_CONTACT: '${GGCHECKOUT_AGENT_CONTACT}' } } },
  };

  it('puts the run values in the MCP config and refuses an unknown name', () => {
    const config = fillMcpConfig(template, { GGCHECKOUT_AGENT_CONTACT: '553199998888' });
    expect(config.mcpServers.ggcheckout.env.GGCHECKOUT_AGENT_CONTACT).toBe('553199998888');
    expect(config.mcpServers.ggcheckout.args).toEqual(['-y', 'ggcheckout-mcp@0.7.0']);
    expect(() => fillMcpConfig(template, {})).toThrow(/no value/);
  });

  it('the prompt has the contact key and the reply id only', () => {
    expect(buildTask({ contactKey: '553199998888', clientMessageId: 'abc' })).toMatch(/contactKey: 553199998888, clientMessageId: abc$/);
  });

  it('the flags leave the model only the agent tools', () => {
    const args = buildClaudeArgs({
      task: 't', rules: 'r', mcpConfigPath: '/tmp/x/mcp.json', serverName: 'ggcheckout', toolNames: ['read_whatsapp_conversation', 'send_whatsapp_reply'],
    });
    const after = (flag) => args[args.indexOf(flag) + 1];
    expect(after('--tools')).toBe('');
    expect(after('--allowedTools')).toBe('mcp__ggcheckout__read_whatsapp_conversation,mcp__ggcheckout__send_whatsapp_reply');
    expect(args).toContain('--strict-mcp-config');
    expect(after('--setting-sources')).toBe('');
    expect(after('--permission-mode')).toBe('dontAsk');
    expect(after('--permission-prompts')).toBe('none');
    expect(args).not.toContain('--disallowedTools');
    expect(args).not.toContain('--dangerously-skip-permissions');
  });
});

describe('the pinned MCP version', () => {
  const template = (args) => ({ mcpServers: { ggcheckout: { command: 'npx', args } } });

  it('reads the exact pin of the recipe template', () => {
    const recipe = JSON.parse(readFileSync(new URL('./.mcp.json', import.meta.url), 'utf-8'));
    expect(pinnedMcpVersion(recipe, 'ggcheckout')).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pinnedMcpVersion(template(['-y', 'ggcheckout-mcp@0.7.0']), 'ggcheckout')).toBe('0.7.0');
  });

  it('refuses a template without an exact pin', () => {
    expect(() => pinnedMcpVersion(template(['-y', 'ggcheckout-mcp@latest']), 'ggcheckout')).toThrow(/must pin/);
    expect(() => pinnedMcpVersion(template(['-y', 'ggcheckout-mcp']), 'ggcheckout')).toThrow(/must pin/);
    expect(() => pinnedMcpVersion(template(['-y', 'ggcheckout-mcp@0.7.0']), 'other')).toThrow(/must pin/);
  });

  it('tells the version refusal from any other 400', () => {
    expect(isOutdatedMcpRefusal(400, { code: 'GGCHECKOUT_MCP_OUTDATED', minVersion: '0.8.0' })).toBe(true);
    expect(isOutdatedMcpRefusal(400, { code: 'AGENT_KEY_INVALID' })).toBe(false);
    expect(isOutdatedMcpRefusal(400, null)).toBe(false);
    expect(isOutdatedMcpRefusal(403, { code: 'GGCHECKOUT_MCP_OUTDATED' })).toBe(false);
  });
});
