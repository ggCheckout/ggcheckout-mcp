import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./base.css', import.meta.url)), 'utf8');

// The sales chart drew a black block over its plot: `[class*='art-']` also matched chart-head and
// chart-body, and each one painted the inherited --art without a backdrop to blend with.
describe('card art selector', () => {
  it('never matches a class by substring', () => {
    expect(css).not.toMatch(/\[class\*=/);
  });

  it('draws exactly the cards that declare an --art', () => {
    const declared = [...css.matchAll(/\.(art-[a-z-]+)\s*\{\s*--art:/g)].map((m) => m[1]).sort();
    const rule = css.match(/:is\(([^)]*)\)::before/);
    const drawn = (rule?.[1] ?? '').split(',').map((s) => s.trim().replace(/^\./, '')).sort();
    expect(declared.length).toBeGreaterThan(0);
    expect(drawn).toEqual(declared);
  });
});
