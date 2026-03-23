import { describe, it, expect } from 'vitest';
import { parsePriceToCents, validateCreateProductInput, validateUpdateProductInput } from './validation.js';
import { ValidationError } from './errors.js';

describe('parsePriceToCents', () => {
  it('converts number in Reais to cents', () => {
    expect(parsePriceToCents(19.90)).toBe(1990);
  });

  it('converts integer to cents', () => {
    expect(parsePriceToCents(100)).toBe(10000);
  });

  it('converts zero to zero', () => {
    expect(parsePriceToCents(0)).toBe(0);
  });

  it('converts small value correctly (avoids floating point)', () => {
    expect(parsePriceToCents(0.01)).toBe(1);
  });

  it('rounds correctly on edge case', () => {
    expect(parsePriceToCents(99.999)).toBe(10000);
  });

  it('converts Brazilian format string "19,90"', () => {
    expect(parsePriceToCents('19,90')).toBe(1990);
  });

  it('converts Brazilian format string with thousands "1.990,50"', () => {
    expect(parsePriceToCents('1.990,50')).toBe(199050);
  });

  it('throws ValidationError for negative number', () => {
    expect(() => parsePriceToCents(-5)).toThrow(ValidationError);
    expect(() => parsePriceToCents(-5)).toThrow('non-negative');
  });

  it('throws ValidationError for invalid string', () => {
    expect(() => parsePriceToCents('abc')).toThrow(ValidationError);
    expect(() => parsePriceToCents('abc')).toThrow('Invalid price format');
  });

  it('throws ValidationError for negative string value', () => {
    expect(() => parsePriceToCents('-10,00')).toThrow(ValidationError);
  });
});

describe('validateCreateProductInput', () => {
  const validInput = {
    title: 'Ebook Marketing',
    description: 'Aprenda marketing digital',
    price: 29.90,
  };

  it('validates and converts price to cents', () => {
    const result = validateCreateProductInput(validInput);
    expect(result.price).toBe(2990);
    expect(result.title).toBe('Ebook Marketing');
  });

  it('passes through extra fields (passthrough schema)', () => {
    const result = validateCreateProductInput({ ...validInput, currency: 'BRL', isPhysicalProduct: false });
    expect(result.currency).toBe('BRL');
    expect(result.isPhysicalProduct).toBe(false);
  });

  it('throws on missing title', () => {
    expect(() => validateCreateProductInput({ description: 'test', price: 10 })).toThrow();
  });

  it('throws on missing description', () => {
    expect(() => validateCreateProductInput({ title: 'test', price: 10 })).toThrow();
  });

  it('throws on missing price', () => {
    expect(() => validateCreateProductInput({ title: 'test', description: 'test' })).toThrow();
  });

  it('accepts string price in Brazilian format', () => {
    const result = validateCreateProductInput({ ...validInput, price: '49,90' });
    expect(result.price).toBe(4990);
  });
});

describe('validateUpdateProductInput', () => {
  it('validates partial input', () => {
    const result = validateUpdateProductInput({ title: 'New Title' });
    expect(result.title).toBe('New Title');
    expect(result.price).toBeUndefined();
  });

  it('converts price when provided', () => {
    const result = validateUpdateProductInput({ price: 59.90 });
    expect(result.price).toBe(5990);
  });

  it('accepts empty object (all optional)', () => {
    const result = validateUpdateProductInput({});
    expect(result).toBeDefined();
  });
});
