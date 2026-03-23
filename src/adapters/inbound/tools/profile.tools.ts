import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProfileService } from '../../../core/services/profile.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerProfileTools(server: McpServer, service: ProfileService) {
  server.tool('get_profile', 'Get the authenticated seller profile',
    createToolHandler('get_profile', async () => {
      const profile = await service.getProfile();
      return { profile };
    }));

  server.registerTool('update_profile', {
    description: 'Update seller profile (name, phone)',
    inputSchema: {
      name: z.string().optional().describe('Full name'),
      displayName: z.string().optional().describe('Display name'),
      phone: z.string().optional().describe('Phone number (local, without country code)'),
      phoneCountryCode: z.string().optional().describe('Phone country code (e.g., "55")'),
    },
  }, createToolHandler('update_profile', async (args) => service.updateProfile(args)));

  server.tool('list_support_emails', 'List configured support emails',
    createToolHandler('list_support_emails', async () => {
      const emails = await service.listSupportEmails();
      return { supportEmails: emails };
    }));

  server.registerTool('add_support_email', {
    description: 'Add a support email (sends verification)',
    inputSchema: {
      name: z.string().describe('Display name for the email'),
      email: z.string().describe('Email address'),
    },
  }, createToolHandler('add_support_email', async ({ name, email }) => {
    const result = await service.addSupportEmail(name, email);
    return { success: true, supportEmail: result };
  }));

  server.registerTool('delete_support_email', {
    description: 'Remove a support email',
    inputSchema: { emailId: z.string().describe('Support email ID') },
  }, createToolHandler('delete_support_email', async ({ emailId }) => {
    await service.deleteSupportEmail(emailId);
    return { success: true, message: 'Support email removed' };
  }));

  server.tool('get_kyc_status', 'Get KYC verification status',
    createToolHandler('get_kyc_status', async () => service.getKycStatus()));
}
