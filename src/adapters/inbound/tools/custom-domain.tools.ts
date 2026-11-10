import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CustomDomainService } from '../../../core/services/custom-domain.service.js';
import { createToolHandler } from '../tool-handler.js';
import { appMeta, withDrawnNote } from '../apps/apps.js';

export function registerCustomDomainTools(server: McpServer, service: CustomDomainService) {
  server.registerTool('list_custom_domains', {
    description: 'List all custom domains: { domains, total, limit }. Each has `status` (pending, verified, failed, '
      + 'disabled); the DNS instructions are only in get_custom_domain.',
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('list_custom_domains', async () => service.list())));

  server.registerTool('add_custom_domain', {
    description: 'Add a custom domain for the checkouts. Subdomains only (checkout.example.com, not example.com), '
      + 'at most 5 per account and 5 additions per 24 hours. Answers the domain with its `dnsInstructions`: the '
      + 'seller creates the CNAME it lists at their DNS provider, then calls verify_custom_domain.',
    inputSchema: { domain: z.string().max(200).describe('Domain name (e.g., "checkout.example.com")') },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('add_custom_domain', async ({ domain }) => {
    const result = await service.add(domain);
    return { success: true, domain: result };
  })));

  server.registerTool('get_custom_domain', {
    description: 'Get a domain with its status and `dnsInstructions` (the CNAME to create and the notes)',
    inputSchema: { domainId: z.string().describe('Domain ID') },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('get_custom_domain', async ({ domainId }) => {
    const domain = await service.getById(domainId);
    return { domain };
  })));

  server.registerTool('delete_custom_domain', {
    description: 'Remove a custom domain',
    inputSchema: { domainId: z.string().describe('Domain ID') },
  }, createToolHandler('delete_custom_domain', async ({ domainId }) => {
    await service.delete(domainId);
    return { success: true, message: 'Domain removed' };
  }));

  server.registerTool('verify_custom_domain', {
    description: 'Check the DNS of a custom domain now (rate limited: 10 per minute). Answers { success, status, '
      + 'checks, cloudflare, message }: `verified` once the CNAME is seen and the SSL certificate is active; '
      + 'while `pending`, `cloudflare.hostnameActive` false means the CNAME is not seen yet and `sslActive` false '
      + 'that the certificate is still being issued. The check also runs on its own within 2 minutes of propagation.',
    inputSchema: { domainId: z.string().describe('Domain ID') },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('verify_custom_domain', async ({ domainId }) => service.verify(domainId))));
}
