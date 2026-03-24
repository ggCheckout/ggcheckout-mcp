import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CustomDomainService } from '../../../core/services/custom-domain.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerCustomDomainTools(server: McpServer, service: CustomDomainService) {
  server.tool('list_custom_domains', 'List all custom domains',
    createToolHandler('list_custom_domains', async () => service.list()));

  server.registerTool('add_custom_domain', {
    description: 'Add a custom domain (max 5 per account)',
    inputSchema: { domain: z.string().max(200).describe('Domain name (e.g., "checkout.example.com")') },
  }, createToolHandler('add_custom_domain', async ({ domain }) => {
    const result = await service.add(domain);
    return { success: true, domain: result };
  }));

  server.registerTool('get_custom_domain', {
    description: 'Get domain details including DNS configuration status',
    inputSchema: { domainId: z.string().describe('Domain ID') },
  }, createToolHandler('get_custom_domain', async ({ domainId }) => {
    const domain = await service.getById(domainId);
    return { domain };
  }));

  server.registerTool('delete_custom_domain', {
    description: 'Remove a custom domain',
    inputSchema: { domainId: z.string().describe('Domain ID') },
  }, createToolHandler('delete_custom_domain', async ({ domainId }) => {
    await service.delete(domainId);
    return { success: true, message: 'Domain removed' };
  }));

  server.registerTool('verify_custom_domain', {
    description: 'Verify DNS configuration for a custom domain (rate limited: 5/hour)',
    inputSchema: { domainId: z.string().describe('Domain ID') },
  }, createToolHandler('verify_custom_domain', async ({ domainId }) => service.verify(domainId)));
}
