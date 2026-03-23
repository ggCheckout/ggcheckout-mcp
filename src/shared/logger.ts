export function info(operation: string, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[MCP] [${timestamp}] [INFO] [${operation}] ${message}`, meta || '');
}

export function warn(operation: string, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[MCP] [${timestamp}] [WARN] [${operation}] ${message}`, meta || '');
}

export function error(operation: string, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[MCP] [${timestamp}] [ERROR] [${operation}] ${message}`, meta || '');
}
