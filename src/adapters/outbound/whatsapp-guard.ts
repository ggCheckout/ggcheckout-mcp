import { ApiError, FeatureUnavailableError, InboxAccessDisabledError, InboxTermsRequiredError } from '../../shared/errors.js';
import { isMissingRoute } from './http-client.js';

function translate(error: unknown): unknown {
  // A 404 with no API error body is a route this deployment does not have; the API's own 404s
  // ("Funil não encontrado.") carry a body and stay as they are.
  if (isMissingRoute(error)) return new FeatureUnavailableError(error);
  if (error instanceof ApiError && error.statusCode === 403) {
    // The HTTP client appends the API's `code` to the message: "API Error (403): <error> (<code>)".
    if (error.message.includes('INBOX_API_ACCESS_DISABLED')) return new InboxAccessDisabledError(error);
    if (error.message.includes('INBOX_TERMS_REQUIRED')) return new InboxTermsRequiredError(error);
  }
  return error;
}

/**
 * Runs a funnel or inbox call and turns what a caller must tell apart into typed errors: the route
 * is not in this deployment yet, the store did not turn the MCP access on, the inbox term is not
 * accepted. Everything else passes through.
 */
export async function guarded<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw translate(error);
  }
}
