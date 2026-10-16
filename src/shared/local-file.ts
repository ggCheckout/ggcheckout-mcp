import { lstat, realpath } from 'node:fs/promises';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import { ValidationError } from './errors.js';

/** What an upload is for, which decides the route and the accepted types. */
export type UploadKind = 'image' | 'video' | 'file';

/** A file on the machine that runs this server, with the type the API will be told. */
export interface LocalFile {
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The types each route accepts, by extension. The content type is part of the upload signature, so
 * it is derived here instead of trusted from the caller; the API still checks the bytes.
 */
const TYPES_BY_KIND: Record<UploadKind, Record<string, string>> = {
  // `/api/uploads-r2`
  image: {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  },
  // `/api/video/presigned-upload`
  video: {
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo', '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg',
  },
  // members-area attachments (`SUPPORTED_FILE_TYPES` in the API)
  file: {
    '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': DOCX,
    '.xls': 'application/vnd.ms-excel', '.xlsx': XLSX,
    '.zip': 'application/zip', '.rar': 'application/x-rar-compressed', '.7z': 'application/x-7z-compressed',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.mpeg': 'video/mpeg',
  },
};

const MB = 1024 * 1024;

/**
 * The largest file each kind uploads: the API's own cap for video (500 MB) and members-area files
 * (100 MB). An image is read whole into memory to post it, so it gets a cap of its own.
 */
export const MAX_BYTES_BY_KIND: Record<UploadKind, number> = { image: 20 * MB, video: 500 * MB, file: 100 * MB };

/** The extensions a kind accepts, for error messages and tool descriptions. */
export function acceptedExtensions(kind: UploadKind): string[] {
  return Object.keys(TYPES_BY_KIND[kind]);
}

/**
 * Resolves an absolute path into an uploadable file.
 *
 * The path comes from an agent, and what the agent reads (a page, a PDF) can carry instructions, so
 * the extension is not the only gate:
 * - nothing uploads until the seller names the folder uploads may read from (`root`, from
 *   `GGCHECKOUT_UPLOAD_ROOT`), and only files under it upload. Its real path is compared, so a link
 *   inside it that points elsewhere is outside it;
 * - relative paths are refused, since the server's working directory is not the caller's;
 * - the file itself must not be a symbolic link (`x.pdf` pointing at a secrets file would otherwise
 *   pass the extension check). Links in the folders above it are fine: the system ones (`/tmp` on
 *   macOS, the temporary folder) are links, and the root check already sees where a path really is;
 * - the size is capped per kind.
 */
export async function readLocalFile(path: string, kind: UploadKind, root: string | undefined): Promise<LocalFile> {
  if (!root) {
    throw new ValidationError(
      'Uploads from this machine are off until the seller names the folder they may read from: set '
      + 'GGCHECKOUT_UPLOAD_ROOT in the MCP server configuration to that folder, restart the server, and '
      + 'put the files there.',
    );
  }
  if (!isAbsolute(path)) {
    throw new ValidationError(`localPath must be an absolute path on the machine running this server, got "${path}".`);
  }
  const fileType = TYPES_BY_KIND[kind][extname(path).toLowerCase()];
  if (!fileType) {
    throw new ValidationError(
      `A ${kind} upload accepts ${acceptedExtensions(kind).join(', ')}; "${basename(path)}" is none of them.`,
    );
  }

  const info = await lstat(path).catch(() => null);
  if (!info) throw new ValidationError(`No file at ${path}.`);
  if (info.isSymbolicLink()) throw new ValidationError(`${path} is a symbolic link; upload the file itself.`);
  if (!info.isFile()) throw new ValidationError(`No file at ${path}.`);

  const real = await realpath(path);
  const realRoot = await realpath(root).catch(() => resolve(root));
  if (!isInside(real, realRoot)) {
    throw new ValidationError(`${path} is outside the upload folder ${root} (GGCHECKOUT_UPLOAD_ROOT).`);
  }

  if (info.size === 0) throw new ValidationError(`${path} is empty.`);
  const max = MAX_BYTES_BY_KIND[kind];
  if (info.size > max) {
    throw new ValidationError(`A ${kind} upload is at most ${max / MB} MB; ${basename(path)} has ${(info.size / MB).toFixed(1)} MB.`);
  }

  return { path: real, fileName: basename(path), fileType, fileSize: info.size };
}

function isInside(path: string, folder: string): boolean {
  const rel = relative(folder, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
