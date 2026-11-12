import type { MediaPort } from '../../core/ports/media.port.js';
import type { LocalFile } from '../../shared/local-file.js';
import type { HttpClient } from './http-client.js';
import { uploadImageViaPresign } from './image-upload.js';

export class MediaApiAdapter implements MediaPort {
  constructor(private readonly http: HttpClient) {}

  async uploadImage(file: LocalFile, preset?: 'banner') {
    return uploadImageViaPresign(this.http, file, preset);
  }
}
