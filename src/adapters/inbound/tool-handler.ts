import * as logger from '../../shared/logger.js';

type ToolResult = {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent?: { [key: string]: unknown };
  isError?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers return domain types that vary per tool
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
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as { [key: string]: unknown },
      };
    } catch (error: any) {
      const duration = Date.now() - start;
      logger.error('TOOL', `${toolName}: Failed (${duration}ms)`, error.message);
      return {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  };
}
