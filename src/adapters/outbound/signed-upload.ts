import axios from 'axios';
import { createReadStream } from 'node:fs';
import type { LocalFile } from '../../shared/local-file.js';
import { ApiError, NetworkError } from '../../shared/errors.js';

/** A 500 MB video on a slow uplink takes minutes; the API's 15 s would never let it finish. */
const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * PUTs a local file to a presigned storage URL, streamed from disk so a large video never sits in
 * memory. No Authorization header: the signature is in the URL and an extra header breaks it.
 * `Content-Type` and `Content-Length` are part of what was signed, so they are the file's own.
 *
 * Errors never carry the URL or the axios error as cause: the URL is a credential until it expires.
 */
export async function putToSignedUrl(uploadUrl: string, file: LocalFile): Promise<void> {
  try {
    await axios.put(uploadUrl, createReadStream(file.path), {
      headers: { 'Content-Type': file.fileType, 'Content-Length': String(file.fileSize) },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: UPLOAD_TIMEOUT_MS,
    });
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status) throw new ApiError(status, `Storage refused the upload of ${file.fileName}; nothing was linked.`);
    throw new NetworkError(`Could not send ${file.fileName} to storage; nothing was linked.`);
  }
}
