import * as logger from './logger.js';

const LATEST_URL = 'https://registry.npmjs.org/ggcheckout-mcp/latest';
const CHECK_TIMEOUT_MS = 2000;

let notice: string | undefined;
let headerWarning: string | undefined;

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

/** The only command the warning names: header text is never put into tool output. */
const UPDATE_COMMAND = 'npx -y ggcheckout-mcp@latest';

/**
 * Reads the API's version headers off a response (both APIs send them). `X-GG-MCP-Update` is only
 * present when the API saw this install announce an older `X-GG-MCP-Version`; its value is ignored
 * (it is remote text) and `X-GG-MCP-Latest` must be a version newer than the running one. The warning
 * is kept for the rest of the session: only a restart can fix it.
 */
export function observeVersionHeaders(
  get: (name: string) => string | null | undefined,
  currentVersion: string,
): void {
  const latest = get('x-gg-mcp-latest')?.trim();
  if (!latest || !get('x-gg-mcp-update')) return;
  if (!/^v?\d+\.\d+\.\d+$/.test(latest) || !isNewerVersion(latest, currentVersion)) return;
  headerWarning = `⚠️ ggcheckout-mcp desatualizado (${currentVersion} → ${latest}). `
    + `Peça ao usuário para rodar \`${UPDATE_COMMAND}\` e reiniciar o cliente.`;
}

/** The one-line pt-BR warning built from the API's version headers, while this install is behind. */
export function getVersionWarning(): string | undefined {
  return headerWarning;
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
  headerWarning = undefined;
}
