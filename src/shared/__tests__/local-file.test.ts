import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_BYTES_BY_KIND, readLocalFile } from '../local-file.js';
import { ValidationError } from '../errors.js';

describe('readLocalFile', () => {
  // Not resolved on purpose: on macOS the temporary folder is itself behind a link
  // (`/var/folders/…` → `/private/var/folders/…`), the case a real caller hits with `/tmp`.
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ggck-local-file-'));
    await mkdir(join(dir, 'real'));
    await writeFile(join(dir, 'real', 'Aula 1.PDF'), 'pdf bytes');
    await writeFile(join(dir, 'empty.mp4'), '');
    await writeFile(join(dir, 'notes.txt'), 'text');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('derives the type from the extension, case-insensitively, and reads the size', async () => {
    const file = await readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'file', dir);
    expect(file).toEqual({
      path: await realpath(join(dir, 'real', 'Aula 1.PDF')),
      fileName: 'Aula 1.PDF',
      fileType: 'application/pdf',
      fileSize: 9,
    });
  });

  // The server's working directory is not the caller's: a relative path would pick the wrong file.
  it('refuses a relative path', async () => {
    await expect(readLocalFile('Aula 1.PDF', 'file', dir)).rejects.toThrow(/absolute path/);
  });

  it('refuses an extension the kind does not take, naming the accepted ones', async () => {
    await expect(readLocalFile(join(dir, 'notes.txt'), 'file', dir)).rejects.toThrow(/\.pdf/);
    await expect(readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'video', dir)).rejects.toThrow(ValidationError);
  });

  it('refuses a missing file and an empty one', async () => {
    await expect(readLocalFile(join(dir, 'missing.png'), 'image', dir)).rejects.toThrow(/No file/);
    await expect(readLocalFile(join(dir, 'empty.mp4'), 'video', dir)).rejects.toThrow(/empty/);
  });

  it('refuses everything while no upload folder is configured', async () => {
    await expect(readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'file', undefined))
      .rejects.toThrow(/GGCHECKOUT_UPLOAD_ROOT/);
  });

  // A path the agent read somewhere can point anywhere; `x.pdf -> ~/.env` must not upload.
  it('refuses a file that is itself a link', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'ggck-outside-'));
    await writeFile(join(outside, 'secret.pdf'), 'secret');
    await symlink(join(outside, 'secret.pdf'), join(dir, 'linked.pdf'));

    await expect(readLocalFile(join(dir, 'linked.pdf'), 'file', dir)).rejects.toThrow(/symbolic link/);
    await rm(outside, { recursive: true, force: true });
  });

  it('refuses a folder link inside the root that leads outside it', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'ggck-outside-'));
    await writeFile(join(outside, 'secret.pdf'), 'secret');
    // A junction needs no privilege on Windows and is a plain symlink elsewhere.
    await symlink(outside, join(dir, 'escape'), 'junction');

    await expect(readLocalFile(join(dir, 'escape', 'secret.pdf'), 'file', dir)).rejects.toThrow(/outside the upload folder/);
    await rm(outside, { recursive: true, force: true });
  });

  // `/tmp` on macOS and the system temporary folder are links; a real file under them is not a trick.
  it('accepts a path through a folder link that stays inside the root', async () => {
    await symlink(join(dir, 'real'), join(dir, 'alias'), 'junction');

    await expect(readLocalFile(join(dir, 'alias', 'Aula 1.PDF'), 'file', dir)).resolves.toMatchObject({ fileSize: 9 });
  });

  it('refuses a file over the cap of its kind', async () => {
    const big = join(dir, 'big.png');
    await writeFile(big, Buffer.alloc(MAX_BYTES_BY_KIND.image + 1));

    await expect(readLocalFile(big, 'image', dir)).rejects.toThrow(/at most 20 MB/);
  });

  it('with a root, uploads only what is under it', async () => {
    await expect(readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'file', join(dir, 'real'))).resolves.toBeTruthy();
    await expect(readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'file', join(dir, 'other')))
      .rejects.toThrow(/outside the upload folder/);
  });
});
