import { describe, expect, it } from 'vitest';
import { tokens } from './index.js';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('design tokens', () => {
  it('uses the Twabibu blue as primary', () => {
    expect(tokens.color.primary).toBe('#2A6BCB');
  });
  it('keeps text readable (WCAG AA, 4.5:1)', () => {
    expect(contrast('#FFFFFF', tokens.color.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.text, tokens.color.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.text, tokens.color.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.ink, tokens.color.slot)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color['text-muted'], tokens.color.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', tokens.color.navy)).toBeGreaterThanOrEqual(4.5);
  });
});
