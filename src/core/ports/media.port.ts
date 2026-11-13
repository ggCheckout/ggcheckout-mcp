import type { LocalFile } from '../../shared/local-file.js';

export interface MediaPort {
  /** Stores an image; `url` is the app-relative `/api/r2-proxy/...` path, `path` the storage key. */
  uploadImage(file: LocalFile, preset?: 'banner'): Promise<{ url: string; path: string }>;
}
