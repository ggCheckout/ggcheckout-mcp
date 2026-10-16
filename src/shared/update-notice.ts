import * as logger from './logger.js';

const LATEST_URL = 'https://registry.npmjs.org/ggcheckout-mcp/latest';
const CHECK_TIMEOUT_MS = 2000;

let notice: string | undefined;

/** Parses `major.minor.patch` (a pre-release suffix is ignored); undefined when it is not one. */
function parseVersion(version: string): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** True only when `latest` is strictly newer than `current`; anything unparseable is not newer. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/** The short line tool responses carry while this install is behind the published version. */
export function getUpdateNotice(): string | undefined {
  return notice;
}

/**
 * Asks the npm registry, once and in the background, whether a newer version is published. It never
 * delays startup (the caller does not await it) and never throws: a slow, offline or odd answer
 * leaves things silent.
 */
export async function checkForUpdate(
  currentVersion: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const response = await fetchImpl(LATEST_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { version?: unknown };
    const latest = typeof body.version === 'string' ? body.version : undefined;
    if (latest && isNewerVersion(latest, currentVersion)) {
      notice = `ggcheckout-mcp ${latest} is available (running ${currentVersion}). `
        + 'Ask the user to restart their MCP client to update; with the @latest install that is all it takes.';
      logger.info('UPDATE', `Version ${latest} is available (running ${currentVersion})`);
    }
  } catch {
    // Offline, blocked or slow: no notice, no noise.
  }
}

/** Test seam: forgets the notice. */
export function resetUpdateNotice(): void {
  notice = undefined;
}
