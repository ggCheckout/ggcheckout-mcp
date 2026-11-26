/** The saas and the core count text in code points (an emoji is 1), not UTF-16 units: `.length` would miscount. */
export const codePoints = (text: string): number => Array.from(text).length;
