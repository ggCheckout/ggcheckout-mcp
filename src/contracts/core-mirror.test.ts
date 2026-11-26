import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The copies of the contract packages the core publishes (`contracts/upstream/ggcheckout-core/`).
 * Each package is copied byte by byte, its `manifest.json` included, and pinned here to the core
 * commit it came from and the sha-256 of that manifest: a fixture and a manifest edited together
 * in this repo would otherwise still pass.
 */
const CORE_MANIFEST_PINS = {
  'whatsapp-agent/v2': {
    coreCommit: '2dbe9bb596663c99f230aa547868a78df60e9aa2',
    manifestSha256: '3ca6a613eff0f8556473d5c70dfbda3a96e3bfa49ef9dc1ff81633077675e279',
  },
} as const;

const UPSTREAM = fileURLToPath(new URL('../../contracts/upstream/ggcheckout-core/', import.meta.url));

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name): string[] => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe.each(Object.entries(CORE_MANIFEST_PINS))('core contract mirror %s', (pkg, pin) => {
  const dir = join(UPSTREAM, pkg);
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { files: Record<string, string> };

  it('the manifest is the one pinned to the core commit', () => {
    expect(sha256(manifestPath)).toBe(pin.manifestSha256);
  });

  it('every file matches the sha of the manifest, with none missing or extra', () => {
    const onDisk = filesUnder(dir).map((path): string => relative(dir, path)).filter((name): boolean => name !== 'manifest.json').sort();
    expect(onDisk).toEqual(Object.keys(manifest.files).sort());
    for (const [name, sha] of Object.entries(manifest.files)) {
      expect(sha256(join(dir, name)), name).toBe(sha);
    }
  });
});
