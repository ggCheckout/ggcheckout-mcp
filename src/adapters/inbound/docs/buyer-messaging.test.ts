import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../../server.js';
import { BUYER_MESSAGING_DOC, BUYER_MESSAGING_URI } from './buyer-messaging.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

const LIVE_KEY = 'ggck_live_' + 'x'.repeat(40);
const AGENT_KEY = 'ggck_agent_' + 'ab12'.repeat(16);

async function clientFor(apiKey: string): Promise<Client> {
  const { server } = createServer({
    apiKey, apiUrl: 'https://qa.example.test', version: '0.8.0', env: { GGCHECKOUT_AGENT_CONTACT: '553199998888' },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('ggcheckout://docs/buyer-messaging', () => {
  it('a seller key reads the document', async () => {
    const client = await clientFor(LIVE_KEY);
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain(BUYER_MESSAGING_URI);
    const { contents } = await client.readResource({ uri: BUYER_MESSAGING_URI });
    expect(contents).toEqual([{ uri: BUYER_MESSAGING_URI, mimeType: 'text/markdown', text: BUYER_MESSAGING_DOC }]);
  });

  it('an assistant run has no resources at all', async () => {
    const client = await clientFor(AGENT_KEY);
    expect(client.getServerCapabilities()?.resources).toBeUndefined();
  });

  it('speaks of the three bands and the limit, in copy fit for the seller', () => {
    for (const band of ['## 1. Avisos', '## 2. Recuperação e venda', '## 3. Conversa']) expect(BUYER_MESSAGING_DOC).toContain(band);
    expect(BUYER_MESSAGING_DOC).toContain('Limite por pessoa');
    expect(BUYER_MESSAGING_DOC).not.toMatch(/[–—]/);
  });
});
