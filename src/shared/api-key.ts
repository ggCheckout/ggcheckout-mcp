/**
 * Which tools a `GGCHECKOUT_API_KEY` opens.
 * - `seller` (`ggck_live_…`): the seller's personal key, every tool group and the views.
 * - `agent` (`ggck_agent_…`): the restricted key of the seller's WhatsApp assistant, only the agent
 *   tools. The saas accepts it on `/api/whatsapp/agent/**` alone, so no other tool would work with it.
 */
export type ApiKeyKind = 'seller' | 'agent';

/** The whole key, as the core mints it: a CR/LF or a second key pasted in the middle is refused here. */
const AGENT_KEY = /^ggck_agent_[a-f0-9]{64}$/;

export function apiKeyKind(key: string): ApiKeyKind {
  if (key.startsWith('ggck_live_')) return 'seller';
  if (key.startsWith('ggck_agent_')) {
    if (!AGENT_KEY.test(key)) throw new Error('GGCHECKOUT_API_KEY is malformed: a ggck_agent_ key is followed by 64 lowercase hex characters');
    return 'agent';
  }
  throw new Error('GGCHECKOUT_API_KEY must start with "ggck_live_" (seller key) or "ggck_agent_" (WhatsApp assistant key)');
}
