import { CATEGORY_COLORS, getCategoryColor } from '../categoryTheme';

describe('CATEGORY_COLORS', () => {
  it('has at least one entry', () => {
    expect(CATEGORY_COLORS.length).toBeGreaterThan(0);
  });

  it('every entry is a valid hex colour', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    CATEGORY_COLORS.forEach(c => expect(c).toMatch(hex));
  });
});

describe('getCategoryColor', () => {
  it('returns the first colour for index 0', () => {
    expect(getCategoryColor(0)).toBe(CATEGORY_COLORS[0]);
  });

  it('returns the second colour for index 1', () => {
    expect(getCategoryColor(1)).toBe(CATEGORY_COLORS[1]);
  });

  it('cycles back to the first colour when index equals palette length', () => {
    expect(getCategoryColor(CATEGORY_COLORS.length)).toBe(CATEGORY_COLORS[0]);
  });

  it('cycles correctly for an index well beyond palette length', () => {
    const idx = CATEGORY_COLORS.length * 3 + 2;
    expect(getCategoryColor(idx)).toBe(CATEGORY_COLORS[2]);
  });

  it('always returns a non-empty string', () => {
    for (let i = 0; i < CATEGORY_COLORS.length * 2; i++) {
      expect(getCategoryColor(i)).toBeTruthy();
    }
  });
});
