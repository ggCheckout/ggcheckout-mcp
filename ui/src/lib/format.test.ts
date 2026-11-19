import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, plural } from './format';

describe('formatDate / formatDateTime', () => {
  it('writes São Paulo time, whatever the viewer zone', () => {
    const iso = '2026-11-06T19:34:18.164123Z';
    expect(formatDate(iso)).toBe('06/11/2026');
    expect(formatDateTime(iso)).toBe('06/11/2026 16:34');
    expect(formatDateTime(iso, { separator: ' às ' })).toBe('06/11/2026 às 16:34');
    expect(formatDateTime(iso, { separator: ', ', seconds: true })).toBe('06/11/2026, 16:34:18');
  });

  it('answers a dash when there is no date', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDateTime('not a date')).toBe('-');
  });
});

describe('plural', () => {
  it('picks the form by count', () => {
    expect(plural(1, 'aula', 'aulas')).toBe('1 aula');
    expect(plural(0, 'aula', 'aulas')).toBe('0 aulas');
  });
});
