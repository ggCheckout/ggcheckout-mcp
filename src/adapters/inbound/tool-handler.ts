import * as logger from '../../shared/logger.js';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: any;
  isError?: boolean;
};

export function createToolHandler(
  toolName: string,
  handler: (args: any) => Promise<any>,
): (args: any) => Promise<ToolResult> {
  return async (args: any): Promise<ToolResult> => {
    const start = Date.now();
    try {
      logger.info('TOOL', `${toolName}: Starting`);
      const result = await handler(args);
      const duration = Date.now() - start;
      logger.info('TOOL', `${toolName}: Success (${duration}ms)`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
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
