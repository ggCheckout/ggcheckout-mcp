import type { AuthPort } from '../../core/ports/auth.port.js';
import type { HttpClient } from './http-client.js';

export class AuthApiAdapter implements AuthPort {
  /** The in-flight or resolved lookup, so concurrent callers share one request. */
  private businessId?: Promise<string>;

  constructor(private readonly http: HttpClient) {}

  /**
   * The business id is constant for the lifetime of an API key and this adapter is built
   * once in the composition root, so the lookup is memoized: nearly every tool needs it,
   * and re-fetching it spent a request per call against the account's rate limit.
   */
  async getMyBusinessId(): Promise<string> {
    if (!this.businessId) {
      this.businessId = this.http
        .get<{ businessId: string }>('/api/me')
        .then((data) => data.businessId)
        .catch((error) => {
          // A failed lookup must not be cached, or one blip poisons the whole session.
          this.businessId = undefined;
          throw error;
        });
    }
    return this.businessId;
  }
}
