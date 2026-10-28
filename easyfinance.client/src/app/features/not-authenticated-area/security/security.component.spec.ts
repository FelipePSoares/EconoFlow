import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { SecurityComponent } from './security.component';
import { GlobalService } from '../../../core/services/global.service';
import {
  SECURITY_PAGE_LAST_UPDATED,
  SECURITY_REPORTING_ADDRESS,
} from '../../../core/services/security.service';

describe('SecurityComponent', () => {
  let globalService: GlobalService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SecurityComponent],
      providers: [...provideTranslateService()]
    });

    globalService = TestBed.inject(GlobalService);
  });

  async function renderWithLanguage(language: string) {
    await globalService.setLocale(language);

    const fixture = TestBed.createComponent(SecurityComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function renderedText(fixture: { nativeElement: HTMLElement }): string {
    return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
  }

  function sectionHeadings(fixture: { nativeElement: HTMLElement }): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('h2'))
      .map(heading => heading.textContent?.trim() ?? '');
  }

  it('should render the English page by default', async () => {
    const text = renderedText(await renderWithLanguage('en'));

    expect(text).toContain('Security and Support');
    expect(text).toContain('Support period');
    expect(text).not.toContain('Segurança e Suporte');
  });

  it('should render the Portuguese page for the pt locale', async () => {
    const text = renderedText(await renderWithLanguage('pt'));

    expect(text).toContain('Segurança e Suporte');
    expect(text).toContain('Período de suporte');
    expect(text).not.toContain('Security and Support');
  });

  it('should publish the support period length and the reporting address', async () => {
    const text = renderedText(await renderWithLanguage('en'));

    expect(text).toContain('12 months after each release');
    expect(text).toContain(SECURITY_REPORTING_ADDRESS);
  });

  it('should tell deployers to forward the client scheme and trust the proxy', async () => {
    // Forwarding X-Forwarded-Proto is only honoured from a trusted address, and the
    // image trusts just 10.42.0.0/16 by default, so both halves must say how to opt
    // the deployer's proxy in. Without it the deployment redirects to itself.
    const englishText = renderedText(await renderWithLanguage('en'));
    const portugueseText = renderedText(await renderWithLanguage('pt'));

    expect(englishText).toContain('ForwardedHeaders__KnownNetworks__0');
    expect(portugueseText).toContain('ForwardedHeaders__KnownNetworks__0');
    expect(englishText).toContain('X-Forwarded-Proto');
    expect(portugueseText).toContain('X-Forwarded-Proto');
  });

  it('should not describe account deletion as confirmed by e-mail', async () => {
    // The server confirms the deletion with a short-lived token that the client
    // applies directly in a dialog (AccessControlController.DeleteUserAsync); it
    // sends no e-mail. The page must not tell users to wait for one, in either
    // language, and must point at the settings menu that actually exists.
    const englishText = renderedText(await renderWithLanguage('en'));
    const portugueseText = renderedText(await renderWithLanguage('pt'));

    expect(englishText).not.toMatch(/delet\w*[^.]{0,60}e-?mail/i);
    expect(portugueseText).not.toMatch(/elimina\w*[^.]{0,60}e-?mail/i);
    expect(englishText).toContain('Settings → Account');
    expect(portugueseText).toContain('Definições → Conta');
  });

  it('should render the same sections in both languages', async () => {
    // The template hard-codes both halves. A translation that silently drops a
    // topic would leave the Portuguese page telling users less than the English one.
    const englishSections = sectionHeadings(await renderWithLanguage('en'));
    const portugueseSections = sectionHeadings(await renderWithLanguage('pt'));

    expect(englishSections.length).toBeGreaterThan(0);
    expect(portugueseSections.length).toBe(englishSections.length);

    englishSections.forEach((heading, index) => {
      const [englishNumber] = heading.split('.');
      const [portugueseNumber] = portugueseSections[index].split('.');
      expect(portugueseNumber).toBe(englishNumber);
    });
  });

  it('should stamp the page with its revision date', async () => {
    const fixture = await renderWithLanguage('en');

    expect(fixture.componentInstance.lastUpdated).toBe(SECURITY_PAGE_LAST_UPDATED);
    expect(fixture.nativeElement.textContent).toContain(SECURITY_PAGE_LAST_UPDATED);
  });
});
