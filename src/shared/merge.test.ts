import { describe, it, expect } from 'vitest';
import { mergeDeep } from './merge.js';

describe('mergeDeep', () => {
  it('merges objects key by key and keeps what the patch does not mention', () => {
    expect(mergeDeep({ a: 1, n: { x: 1, y: 2 } }, { n: { y: 3 }, b: 2 })).toEqual({ a: 1, n: { x: 1, y: 3 }, b: 2 });
  });

  it('replaces arrays instead of merging them', () => {
    expect(mergeDeep({ list: [1, 2, 3] }, { list: [9] })).toEqual({ list: [9] });
  });

  it('replaces with null, and leaves the key alone for undefined', () => {
    expect(mergeDeep({ a: { x: 1 }, b: 2 }, { a: null, b: undefined })).toEqual({ a: null, b: 2 });
  });

  it('replaces a primitive with an object and an object with a primitive', () => {
    expect(mergeDeep({ a: 1 }, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
    expect(mergeDeep({ a: { x: 1 } }, { a: 'flat' })).toEqual({ a: 'flat' });
  });

  it('does not mutate its inputs', () => {
    const base = { n: { x: 1 } };
    mergeDeep(base, { n: { x: 2 } });
    expect(base).toEqual({ n: { x: 1 } });
  });

  it('returns the base for an undefined patch, and the patch when the base is not an object', () => {
    expect(mergeDeep({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(mergeDeep(null, { a: 1 })).toEqual({ a: 1 });
  });
});
