function log(level: 'INFO' | 'WARN' | 'ERROR', operation: string, message: string, meta?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    operation,
    message,
    ...(meta !== undefined && meta !== '' ? { meta } : {}),
  };
  console.error(JSON.stringify(entry));
}

export function info(operation: string, message: string, meta?: unknown) {
  log('INFO', operation, message, meta);
}

export function warn(operation: string, message: string, meta?: unknown) {
  log('WARN', operation, message, meta);
}

export function error(operation: string, message: string, meta?: unknown) {
  log('ERROR', operation, message, meta);
}
