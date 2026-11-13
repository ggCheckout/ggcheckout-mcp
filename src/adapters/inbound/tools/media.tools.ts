import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MediaService } from '../../../core/services/media.service.js';
import { createToolHandler } from '../tool-handler.js';
import { acceptedExtensions } from '../../../shared/local-file.js';

export function registerMediaTools(server: McpServer, service: MediaService) {
  server.registerTool(
    'upload_media',
    {
      description:
        'Upload an image from the machine running this MCP server (inside GGCHECKOUT_UPLOAD_ROOT; refused while '
        + `unset). Accepts ${acceptedExtensions('image').join(' ')}, up to 20 MB. Returns { url, path }: \`url\` is the `
        + 'relative `/api/r2-proxy/...` path to pass as a checkout `image` or `bannerUrl` (create_checkout / '
        + 'update_checkout), an upsell or downsell `customImage.url`, or any image field that takes it. '
        + 'For members-area images use upload_members_area_file.',
      inputSchema: {
        localPath: z.string().min(1).describe('Absolute path of the image, inside GGCHECKOUT_UPLOAD_ROOT, on the machine running this server'),
        preset: z.enum(['banner']).optional().describe('Processing preset for tall banners, so they are not cropped'),
      },
    },
    createToolHandler('upload_media', async (args) => {
      const upload = await service.uploadImage(args);
      return { success: true, ...upload };
    }),
  );
}
