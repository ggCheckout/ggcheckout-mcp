import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, ValidationError, AuthenticationError, RateLimitError, ApiError } from './errors.js';

describe('Error classes', () => {
  it('AppError has code and statusCode', () => {
    const err = new AppError('test', 'TEST_CODE', 400);
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('NotFoundError formats resource and id', () => {
    const err = new NotFoundError('Product', 'abc123');
    expect(err.message).toBe('Product abc123 not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('ValidationError has 400 status', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('AuthenticationError has 401 status', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication failed');
  });

  it('RateLimitError has 429 status', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
  });

  it('ApiError includes status in message', () => {
    const err = new ApiError(503, 'Service Unavailable');
    expect(err.message).toBe('API Error (503): Service Unavailable');
    expect(err.statusCode).toBe(503);
  });
});
