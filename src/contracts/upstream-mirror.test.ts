import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The copies of the contract packages other repos publish (`contracts/upstream/<producer>/`). Each
 * package is copied byte by byte, its `manifest.json` included, and pinned here to the producer commit
 * it came from and the sha-256 of that manifest: a fixture and a manifest edited together in this repo
 * would otherwise still pass.
 */
const UPSTREAM_PINS = {
  'ggcheckout-core/whatsapp-agent/v2': {
    commit: '2d9297404900ede5a393b2c14e9b84594fef5969',
    manifestSha256: '8fd7505aeced008d08efcf8a47bfba7c59019142e880a84c50bce2b21a775777',
  },
  'saas-checkout/buyer-messaging/overview/v1': {
    commit: '8f1ed336d4485faa63fa3804f64df8b33f4bfb8c',
    manifestSha256: 'f3a45651373233182a41f5c0c6b7a0ef60f61ad9871b14977d51f490addd3275',
  },
} as const;

const UPSTREAM = fileURLToPath(new URL('../../contracts/upstream/', import.meta.url));

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name): string[] => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe.each(Object.entries(UPSTREAM_PINS))('contract mirror %s', (pkg, pin) => {
  const dir = join(UPSTREAM, pkg);
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { files: Record<string, string> };

  it('the manifest is the one pinned to the producer commit', () => {
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
