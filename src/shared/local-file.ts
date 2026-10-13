import { stat } from 'node:fs/promises';
import { basename, extname, isAbsolute } from 'node:path';
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

/** The extensions a kind accepts, for error messages and tool descriptions. */
export function acceptedExtensions(kind: UploadKind): string[] {
  return Object.keys(TYPES_BY_KIND[kind]);
}

/**
 * Resolves an absolute path into an uploadable file. Relative paths are refused: the server's working
 * directory is not the caller's, and guessing it would upload the wrong file.
 */
export async function readLocalFile(path: string, kind: UploadKind): Promise<LocalFile> {
  if (!isAbsolute(path)) {
    throw new ValidationError(`localPath must be an absolute path on the machine running this server, got "${path}".`);
  }
  const fileType = TYPES_BY_KIND[kind][extname(path).toLowerCase()];
  if (!fileType) {
    throw new ValidationError(
      `A ${kind} upload accepts ${acceptedExtensions(kind).join(', ')}; "${basename(path)}" is none of them.`,
    );
  }

  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new ValidationError(`No file at ${path}.`);
  if (info.size === 0) throw new ValidationError(`${path} is empty.`);

  return { path, fileName: basename(path), fileType, fileSize: info.size };
}
