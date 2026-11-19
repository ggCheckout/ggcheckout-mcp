import type { LocalFile } from '../../shared/local-file.js';
import type { HttpClient } from './http-client.js';
import { putToSignedUrl } from './signed-upload.js';

/** What the image presign route answers: where to PUT the bytes, and the key that names them. */
type ImagePresign = { uploadUrl: string; filePath: string; headers?: Record<string, string>; expiresIn?: number };

/**
 * Uploads an image the way the dashboard does: presign, PUT the bytes straight to storage, confirm.
 * The confirm makes the server sanitize the stored image and answers the app-relative
 * `/api/r2-proxy/...` URL that logos, banners and covers store.
 *
 * Not the multipart `POST /api/uploads-r2`: the Cloudflare WAF blocks that body shape in front of the API.
 * The bytes now go to storage, so the WAF never sees them.
 */
export async function uploadImageViaPresign(
  http: HttpClient,
  file: LocalFile,
  preset?: 'banner',
): Promise<{ url: string; path: string }> {
  const presign = await http.post<ImagePresign>('/api/uploads-r2/presigned-upload', {
    fileName: file.fileName,
    contentType: file.fileType,
    size: file.fileSize,
  });
  await putToSignedUrl(presign.uploadUrl, file, presign.headers);
  const done = await http.post<{ success: boolean; url: string; path: string }>(
    '/api/uploads-r2/complete-upload',
    { filePath: presign.filePath, ...(preset ? { preset } : {}) },
  );
  return { url: done.url, path: done.path };
}
