import { describe, it, expect } from 'vitest';
import { explainMissingRoute } from './http-client.js';
import { ApiError } from '../../shared/errors.js';

describe('explainMissingRoute', () => {
  // A route the deployment does not have answers the framework's 404, with no API error in the body.
  it('explains a 404 or 405 that carries no API error', () => {
    const missing = explainMissingRoute(new ApiError(404, 'Request failed with status 404'), 'needs X.');
    const method = explainMissingRoute(new ApiError(405, 'Request failed with status 405'), 'needs X.');

    expect((missing as Error).message).toContain('has no such route yet: needs X.');
    expect((method as Error).message).toContain('has no such route yet');
  });

  it('leaves the API\'s own refusals alone', () => {
    const notFound = new ApiError(404, 'Upsell não encontrado');
    const other = new Error('boom');

    expect(explainMissingRoute(notFound, 'needs X.')).toBe(notFound);
    expect(explainMissingRoute(other, 'needs X.')).toBe(other);
  });
});
