import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLocalFile } from '../local-file.js';
import { ValidationError } from '../errors.js';

describe('readLocalFile', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ggck-local-file-'));
    await writeFile(join(dir, 'Aula 1.PDF'), 'pdf bytes');
    await writeFile(join(dir, 'empty.mp4'), '');
    await writeFile(join(dir, 'notes.txt'), 'text');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('derives the type from the extension, case-insensitively, and reads the size', async () => {
    const file = await readLocalFile(join(dir, 'Aula 1.PDF'), 'file');
    expect(file).toEqual({
      path: join(dir, 'Aula 1.PDF'),
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
    await expect(readLocalFile(join(dir, 'Aula 1.PDF'), 'video')).rejects.toThrow(ValidationError);
  });

  it('refuses a missing file and an empty one', async () => {
    await expect(readLocalFile(join(dir, 'missing.png'), 'image')).rejects.toThrow(/No file/);
    await expect(readLocalFile(join(dir, 'empty.mp4'), 'video')).rejects.toThrow(/empty/);
  });
});
