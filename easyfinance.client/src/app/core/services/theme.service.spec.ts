import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const storageKey = 'theme-mode';

  beforeEach(() => {
    localStorage.removeItem(storageKey);
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('should load initial theme from localStorage when available', () => {
    localStorage.setItem(storageKey, 'dark');
    const service = TestBed.inject(ThemeService);

    expect(service.currentTheme).toBe('dark');
  });

  it('should persist selected theme', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');

    expect(localStorage.getItem(storageKey)).toBe('dark');
  });

  it('should update document attribute when toggling', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    service.toggleTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
