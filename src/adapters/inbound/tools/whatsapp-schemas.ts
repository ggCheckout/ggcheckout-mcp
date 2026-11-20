import { z } from 'zod';
import { FUNNEL_LIMITS } from '../../../core/types/whatsapp-funnel.js';

/** The saas counts text in code points (an emoji is 1), not UTF-16 units: `.max()` would miscount. */
export const codePoints = (text: string): number => Array.from(text).length;

/** Text capped in code points; `trim` mirrors the fields the core trims before counting. */
export const cappedText = (max: number, { trim = false } = {}) =>
  z.string().refine((value) => codePoints(trim ? value.trim() : value) <= max, { message: `At most ${max} characters` });

/** A funnel or session id: any 8-4-4-4-12 hexadecimal, as the core parses it. */
export const guid = () => z.guid();

const CONTACT_KEY = /^(?:[1-9][0-9]{7,14}|lid:[A-Za-z0-9_@.-]{1,128})$/;

/**
 * The conversation key of the inbox: the contact's phone (digits with country code, no `+`) or a
 * `lid:` WhatsApp id. The canonical Brazilian mobile has no ninth digit (55 + area code + 8 digits),
 * as WhatsApp keys it; the 13-digit form is refused, as the route does.
 */
export const contactKey = z.string().regex(CONTACT_KEY)
  .refine((key) => !/^55[0-9]{2}9[6-9][0-9]{7}$/.test(key), 'Phone must be in canonical form')
  .describe('Conversation key as the inbox lists it: the contact phone in digits with country code ("553199998888", a Brazilian mobile without the ninth digit) or a "lid:" WhatsApp id');

/** Start values of a manual run (`{{customer_name}}`, ...): key `[a-z0-9_]{1,40}`, up to 32 of them. */
export const funnelVariables = z.record(z.string().regex(/^[a-z0-9_]{1,40}$/), cappedText(FUNNEL_LIMITS.maxVariableValue))
  .refine((variables) => Object.keys(variables).length <= FUNNEL_LIMITS.maxVariables, { message: `At most ${FUNNEL_LIMITS.maxVariables} variables` });
