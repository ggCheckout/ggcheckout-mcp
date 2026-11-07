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

/** The package spec every update path ends on. */
export const UPDATE_COMMAND = 'ggcheckout-mcp@latest';

/**
 * How to update, per install kind: `npx -y ggcheckout-mcp@latest` alone touches neither a global
 * install nor a version pinned in the config. Header text is never put into tool output, only this.
 */
export const UPDATE_STEPS = 'with `ggcheckout-mcp@latest` in the MCP config, restart the client; '
  + 'with a global install, run `npm i -g ggcheckout-mcp@latest` and restart; '
  + 'with a pinned version, change it in the config and restart.';

/**
 * Reads the API's version headers off a response (both APIs send them). `X-GG-MCP-Update` is only
 * present when the API judged this install (by its User-Agent) to be behind; its value is ignored
 * (it is remote text) and `X-GG-MCP-Latest` must be a version newer than the running one. The notice
 * is kept for the rest of the session: only a restart can fix it.
 */
export function observeVersionHeaders(
  get: (name: string) => string | null | undefined,
  currentVersion: string,
): void {
  const latest = get('x-gg-mcp-latest')?.trim();
  if (!latest || !get('x-gg-mcp-update')) return;
  if (!/^v?\d+\.\d+\.\d+$/.test(latest) || !isNewerVersion(latest, currentVersion)) return;
  notice = `ggcheckout-mcp ${latest} is available (running ${currentVersion}). `
    + `Tell the user how to update: ${UPDATE_STEPS}`;
}

/** The short line tool responses carry while the API says this install is behind. */
export function getUpdateNotice(): string | undefined {
  return notice;
}

/** Test seam: forgets the notice. */
export function resetUpdateNotice(): void {
  notice = undefined;
}
