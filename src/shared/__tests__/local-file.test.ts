import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_BYTES_BY_KIND, readLocalFile } from '../local-file.js';
import { ValidationError } from '../errors.js';

describe('readLocalFile', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ggck-local-file-')));
    await mkdir(join(dir, 'real'));
    await writeFile(join(dir, 'real', 'Aula 1.PDF'), 'pdf bytes');
    await writeFile(join(dir, 'empty.mp4'), '');
    await writeFile(join(dir, 'notes.txt'), 'text');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('derives the type from the extension, case-insensitively, and reads the size', async () => {
    const file = await readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'file');
    expect(file).toEqual({
      path: join(dir, 'real', 'Aula 1.PDF'),
      fileName: 'Aula 1.PDF',
      fileType: 'application/pdf',
      fileSize: 9,
    });
  });

  // The server's working directory is not the caller's: a relative path would pick the wrong file.
  it('refuses a relative path', async () => {
    await expect(readLocalFile('Aula 1.PDF', 'file')).rejects.toThrow(/absolute path/);
  });

  it('refuses an extension the kind does not take, naming the accepted ones', async () => {
    await expect(readLocalFile(join(dir, 'notes.txt'), 'file')).rejects.toThrow(/\.pdf/);
    await expect(readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'video')).rejects.toThrow(ValidationError);
  });

  it('refuses a missing file and an empty one', async () => {
    await expect(readLocalFile(join(dir, 'missing.png'), 'image')).rejects.toThrow(/No file/);
    await expect(readLocalFile(join(dir, 'empty.mp4'), 'video')).rejects.toThrow(/empty/);
  });

  // A path the agent read somewhere can point anywhere; `/tmp/x.pdf -> ~/.env` must not upload.
  it('refuses a path that goes through a link', async () => {
    const linked = join(dir, 'linked');
    // A junction needs no privilege on Windows and is a plain symlink elsewhere.
    await symlink(join(dir, 'real'), linked, 'junction');

    await expect(readLocalFile(join(linked, 'Aula 1.PDF'), 'file')).rejects.toThrow(/symbolic link/);
  });

  it('refuses a file over the cap of its kind', async () => {
    const big = join(dir, 'big.png');
    await writeFile(big, Buffer.alloc(MAX_BYTES_BY_KIND.image + 1));

    await expect(readLocalFile(big, 'image')).rejects.toThrow(/at most 20 MB/);
  });

  it('with a root, uploads only what is under it', async () => {
    await expect(readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'file', join(dir, 'real'))).resolves.toBeTruthy();
    await expect(readLocalFile(join(dir, 'real', 'Aula 1.PDF'), 'file', join(dir, 'other')))
      .rejects.toThrow(/outside the upload folder/);
  });
});
