import type { MediaPort } from '../ports/media.port.js';
import { readLocalFile } from '../../shared/local-file.js';

export class MediaService {
  constructor(
    private readonly port: MediaPort,
    /** `GGCHECKOUT_UPLOAD_ROOT`: the only folder uploads read from; unset, uploads are refused. */
    private readonly uploadRoot?: string,
  ) {}

  /**
   * Uploads an image from the machine that runs this server. Nothing is linked here: the answer is the
   * relative `/api/r2-proxy/...` URL for the field that uses it (a checkout's `image` or `bannerUrl`,
   * an offer's `customImage`, a members-area logo…).
   */
  async uploadImage(input: { localPath: string; preset?: 'banner' }) {
    const file = await readLocalFile(input.localPath, 'image', this.uploadRoot);
    const stored = await this.port.uploadImage(file, input.preset);
    return { ...stored, fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize };
  }
}
