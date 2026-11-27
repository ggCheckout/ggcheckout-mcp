import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AGENT_DECLARED_CATEGORIES, AGENT_ESCALATION_CODES, AGENT_LIMITS, AGENT_TASK_SKIP_REASONS } from './whatsapp-agent.js';
import { AGENT_REFUSALS } from '../../shared/errors.js';

/** The core's whatsapp-agent v2 contract, mirrored byte by byte (see contracts/upstream/README.md). */
const schema = JSON.parse(readFileSync(new URL('../../../contracts/upstream/ggcheckout-core/whatsapp-agent/v2/schema.json', import.meta.url), 'utf-8'));
const defs = schema.$defs;
const limits = schema['x-limits'];

/** Refusals of the panel's routes and of the webhook's voice lookup: the agent key never meets them. */
const PANEL_ONLY = ['AGENT_DRAFT_NOT_FOUND', 'AGENT_SETTINGS_CHANGED', 'AGENT_VOICE_KEY_MISSING', 'AGENT_VOICE_NOT_FOUND'];

describe('agent limits against the core contract (whatsapp-agent/v2)', () => {
  it('the turn limits are the contract\'s', () => {
    expect(AGENT_LIMITS.bubblesMin).toBe(limits.bubblesMin);
    expect(AGENT_LIMITS.bubblesMax).toBe(limits.bubblesMax);
    expect(AGENT_LIMITS.bubblesMax).toBe(defs.bubbles.maxItems);
    expect(AGENT_LIMITS.bubbleMaxChars).toBe(defs.bubble.maxLength);
    expect(AGENT_LIMITS.privateNoteMaxChars).toBe(limits.privateNoteMaxChars);
    expect(AGENT_LIMITS.privateNoteMaxChars).toBe(defs.privateNote.maxLength);
    expect(AGENT_LIMITS.escalationSummaryMaxChars).toBe(limits.escalationSummaryMaxChars);
    expect(AGENT_LIMITS.escalationSummaryMaxChars).toBe(defs.AgentEscalateBody.properties.summary.maxLength);
    expect(AGENT_LIMITS.turnClientMessageIdMaxChars).toBe(limits.turnClientMessageIdMaxChars);
    expect(defs.turnClientMessageId.pattern).toBe(`^[A-Za-z0-9_-]{1,${AGENT_LIMITS.turnClientMessageIdMaxChars}}$`);
  });

  it('the model declares only the categories the saas does not prove', () => {
    for (const category of AGENT_DECLARED_CATEGORIES) expect(defs.category.enum).toContain(category);
    expect(AGENT_DECLARED_CATEGORIES).not.toContain('recovery');
    expect(AGENT_DECLARED_CATEGORIES).not.toContain('access');
  });

  it('the escalation codes are exactly the contract\'s', () => {
    expect([...AGENT_ESCALATION_CODES]).toEqual(defs.escalationCode.enum);
  });

  it('the reasons to skip a task are exactly the contract\'s', () => {
    expect([...AGENT_TASK_SKIP_REASONS]).toEqual(defs.AgentTaskSkipBody.properties.reason.enum);
  });

  it('every refusal the assistant can meet has a message for the model', () => {
    const codes: string[] = defs.AgentRefusalError.properties.error.enum;
    for (const code of codes.filter((c) => !PANEL_ONLY.includes(c))) expect(Object.keys(AGENT_REFUSALS)).toContain(code);
    expect(Object.keys(AGENT_REFUSALS)).not.toContain('AGENT_REPLY_CAP');
  });
});
