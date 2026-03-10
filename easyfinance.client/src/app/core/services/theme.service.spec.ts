import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const storageKey = 'theme-mode';
  const createdNodes: HTMLElement[] = [];

  let themeColorMeta: HTMLMetaElement;
  let statusBarMeta: HTMLMetaElement;
  let manifestLink: HTMLLinkElement;

  function ensureMeta(name: string, content: string): HTMLMetaElement {
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
      createdNodes.push(meta);
    }

    meta.setAttribute('content', content);
    return meta;
  }

  function ensureManifestLink(href: string): HTMLLinkElement {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'manifest');
      document.head.appendChild(link);
      createdNodes.push(link);
    }

    link.setAttribute('href', href);
    return link;
  }

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    themeColorMeta = ensureMeta('theme-color', '#0f76a8');
    statusBarMeta = ensureMeta('apple-mobile-web-app-status-bar-style', 'default');
    manifestLink = ensureManifestLink('/manifest.webmanifest');
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
    while (createdNodes.length > 0) {
      const node = createdNodes.pop();
      node?.remove();
    }
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

  it('should update manifest and meta tags when dark theme is selected', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('dark');

    expect(themeColorMeta.getAttribute('content')).toBe('#0f1724');
    expect(statusBarMeta.getAttribute('content')).toBe('black-translucent');
    expect(manifestLink.getAttribute('href')).toBe('/manifest.dark.webmanifest');
  });
});
