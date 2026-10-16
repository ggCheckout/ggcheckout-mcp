import * as logger from '../../shared/logger.js';
import { getUpdateNotice } from '../../shared/update-notice.js';

type ToolResult = {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent?: { [key: string]: unknown };
  isError?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers return domain types that vary per tool
/** While this install is behind the published version, every response ends with a short update line. */
function withUpdateNotice(result: ToolResult): ToolResult {
  const update = getUpdateNotice();
  return update ? { ...result, content: [...result.content, { type: 'text' as const, text: `update: ${update}` }] } : result;
}

export function createToolHandler<TArgs = Record<string, unknown>>(
  toolName: string,
  handler: (args: TArgs) => Promise<any>,
): (args: TArgs) => Promise<ToolResult> {
  return async (args: TArgs): Promise<ToolResult> => {
    const start = Date.now();
    try {
      logger.info('TOOL', `${toolName}: Starting`);
      const result = await handler(args);
      const duration = Date.now() - start;
      logger.info('TOOL', `${toolName}: Success (${duration}ms)`);
      return withUpdateNotice({
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as { [key: string]: unknown },
      });
    } catch (error: any) {
      const duration = Date.now() - start;
      logger.error('TOOL', `${toolName}: Failed (${duration}ms)`, error.message);
      return withUpdateNotice({
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      });
    }
  };
}
