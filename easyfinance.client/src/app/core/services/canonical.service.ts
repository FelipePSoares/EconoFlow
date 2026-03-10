import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

type SupportedLanguage = 'en' | 'pt';
type LocalizedPublicPath = '/' | '/privacy-policy' | '/use-terms' | '/contact-us' | '/offline';

interface PublicSeoEntry {
  title: Record<SupportedLanguage, string>;
  description: Record<SupportedLanguage, string>;
}

interface ResolvedSeoContext {
  language: SupportedLanguage;
  title: string;
  description: string;
  robots: string;
  canonicalPath: string;
  ogType: string;
  alternateEnPath?: string;
  alternatePtPath?: string;
  xDefaultPath?: string;
}

const siteOrigin = 'https://econoflow.pt';

const localizedPublicPaths = new Set<LocalizedPublicPath>([
  '/',
  '/privacy-policy',
  '/use-terms',
  '/contact-us',
  '/offline'
]);

const publicAuthPaths = new Set(['/login', '/register', '/recovery']);

const publicSeoByPath: Record<LocalizedPublicPath, PublicSeoEntry> = {
  '/': {
    title: {
      en: 'EconoFlow - Open-source personal finance management',
      pt: 'EconoFlow - Controle financeiro pessoal open source'
    },
    description: {
      en: 'Track expenses, plan budgets, collaborate on projects, and protect your account with two-factor authentication.',
      pt: 'Registre despesas, planeie orçamentos, colabore em projetos e proteja a sua conta com autenticação de dois fatores.'
    }
  },
  '/privacy-policy': {
    title: {
      en: 'Privacy Policy - EconoFlow',
      pt: 'Política de Privacidade - EconoFlow'
    },
    description: {
      en: 'Review how EconoFlow collects, stores, and protects personal and financial data under GDPR principles.',
      pt: 'Veja como o EconoFlow coleta, armazena e protege dados pessoais e financeiros de acordo com os princípios do RGPD.'
    }
  },
  '/use-terms': {
    title: {
      en: 'Terms of Use - EconoFlow',
      pt: 'Termos de Uso - EconoFlow'
    },
    description: {
      en: 'Read EconoFlow terms of use, account responsibilities, acceptable usage, and service limitations.',
      pt: 'Leia os termos de uso do EconoFlow, responsabilidades da conta, uso aceitável e limitações do serviço.'
    }
  },
  '/contact-us': {
    title: {
      en: 'Contact Us - EconoFlow',
      pt: 'Contacte-nos - EconoFlow'
    },
    description: {
      en: 'Send questions, feedback, or support requests directly to the EconoFlow team.',
      pt: 'Envie perguntas, feedback ou pedidos de suporte diretamente para a equipa do EconoFlow.'
    }
  },
  '/offline': {
    title: {
      en: 'Offline Mode - EconoFlow',
      pt: 'Modo Offline - EconoFlow'
    },
    description: {
      en: 'Offline fallback page with retry action while EconoFlow reconnects.',
      pt: 'Página de fallback offline com opção de tentar novamente quando o EconoFlow voltar a ligar.'
    }
  }
};

const authSeoByPath: Record<string, PublicSeoEntry> = {
  '/login': {
    title: {
      en: 'Sign In - EconoFlow',
      pt: 'Entrar - EconoFlow'
    },
    description: {
      en: 'Sign in to your EconoFlow account.',
      pt: 'Entre na sua conta EconoFlow.'
    }
  },
  '/register': {
    title: {
      en: 'Create Account - EconoFlow',
      pt: 'Criar Conta - EconoFlow'
    },
    description: {
      en: 'Create your EconoFlow account to manage personal finances.',
      pt: 'Crie a sua conta EconoFlow para gerir as suas finanças pessoais.'
    }
  },
  '/recovery': {
    title: {
      en: 'Recover Password - EconoFlow',
      pt: 'Recuperar Palavra-passe - EconoFlow'
    },
    description: {
      en: 'Recover access to your EconoFlow account.',
      pt: 'Recupere o acesso à sua conta EconoFlow.'
    }
  }
};

@Injectable({
  providedIn: 'root'
})
export class CanonicalService {
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private title = inject(Title);
  private meta = inject(Meta);

  constructor() {
    this.applySeo(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.applySeo(event.urlAfterRedirects || event.url);
      });
  }

  private applySeo(url: string): void {
    const routePath = this.extractPrimaryPathFromUrl(url);
    const context = this.resolveSeoContext(routePath);
    const canonicalUrl = `${siteOrigin}${context.canonicalPath}`;
    const localizedCurrentUrl = `${siteOrigin}${routePath}`;

    this.title.setTitle(context.title);
    this.updateMetaTagByName('description', context.description);
    this.updateMetaTagByName('robots', context.robots);
    this.updateMetaTagByName('twitter:card', 'summary_large_image');
    this.updateMetaTagByName('twitter:title', context.title);
    this.updateMetaTagByName('twitter:description', context.description);
    this.updateMetaTagByName('twitter:image', `${siteOrigin}/assets/images/Logo-without-text-1200.jpg`);
    this.updateMetaTagByName('twitter:url', localizedCurrentUrl);

    this.updateMetaTagByProperty('og:type', context.ogType);
    this.updateMetaTagByProperty('og:title', context.title);
    this.updateMetaTagByProperty('og:description', context.description);
    this.updateMetaTagByProperty('og:url', localizedCurrentUrl);
    this.updateMetaTagByProperty('og:image', `${siteOrigin}/assets/images/Logo-without-text-1200.jpg`);
    this.updateMetaTagByProperty('og:image:type', 'image/jpeg');
    this.updateMetaTagByProperty('og:site_name', 'EconoFlow');
    this.updateMetaTagByProperty('og:locale', context.language === 'pt' ? 'pt_PT' : 'en_US');

    this.upsertLink('canonical', {
      rel: 'canonical',
      href: canonicalUrl
    });

    if (context.alternateEnPath && context.alternatePtPath && context.xDefaultPath) {
      this.upsertLink('alternate-en', {
        rel: 'alternate',
        hreflang: 'en',
        href: `${siteOrigin}${context.alternateEnPath}`
      });
      this.upsertLink('alternate-pt', {
        rel: 'alternate',
        hreflang: 'pt',
        href: `${siteOrigin}${context.alternatePtPath}`
      });
      this.upsertLink('alternate-x-default', {
        rel: 'alternate',
        hreflang: 'x-default',
        href: `${siteOrigin}${context.xDefaultPath}`
      });
    } else {
      this.removeLink('alternate-en');
      this.removeLink('alternate-pt');
      this.removeLink('alternate-x-default');
    }

    this.document.documentElement.setAttribute('lang', context.language);
  }

  private resolveSeoContext(routePath: string): ResolvedSeoContext {
    const normalizedRoutePath = this.normalizePath(routePath);
    const { language, localizedRoutePath } = this.getLocalizedRouteInfo(normalizedRoutePath);

    if (this.isLocalizedPublicPath(localizedRoutePath)) {
      const entry = publicSeoByPath[localizedRoutePath];
      return {
        language,
        title: entry.title[language],
        description: entry.description[language],
        robots: 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1',
        canonicalPath: normalizedRoutePath,
        ogType: 'website',
        alternateEnPath: this.toEnglishPath(localizedRoutePath),
        alternatePtPath: this.toPortuguesePath(localizedRoutePath),
        xDefaultPath: this.toEnglishPath(localizedRoutePath)
      };
    }

    if (publicAuthPaths.has(normalizedRoutePath)) {
      const entry = authSeoByPath[normalizedRoutePath];
      return {
        language,
        title: entry.title[language],
        description: entry.description[language],
        robots: 'noindex,nofollow,noarchive',
        canonicalPath: normalizedRoutePath,
        ogType: 'website'
      };
    }

    return {
      language,
      title: 'EconoFlow',
      description: 'EconoFlow personal finance application.',
      robots: 'noindex,nofollow,noarchive',
      canonicalPath: normalizedRoutePath,
      ogType: 'website'
    };
  }

  private extractPrimaryPathFromUrl(url: string): string {
    const parsedUrl = this.router.parseUrl(url);
    const primarySegments = parsedUrl.root.children['primary']?.segments.map(segment => segment.path) ?? [];
    return this.normalizePath(`/${primarySegments.join('/')}`);
  }

  private getLocalizedRouteInfo(routePath: string): { language: SupportedLanguage, localizedRoutePath: string } {
    if (routePath === '/pt') {
      return { language: 'pt', localizedRoutePath: '/' };
    }

    if (routePath.startsWith('/pt/')) {
      return { language: 'pt', localizedRoutePath: this.normalizePath(routePath.slice('/pt'.length)) };
    }

    return { language: 'en', localizedRoutePath: routePath };
  }

  private isLocalizedPublicPath(routePath: string): routePath is LocalizedPublicPath {
    return localizedPublicPaths.has(routePath as LocalizedPublicPath);
  }

  private toEnglishPath(routePath: LocalizedPublicPath): string {
    return routePath;
  }

  private toPortuguesePath(routePath: LocalizedPublicPath): string {
    return routePath === '/' ? '/pt' : `/pt${routePath}`;
  }

  private normalizePath(path: string): string {
    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
    const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/g, '');
    return withoutTrailingSlash || '/';
  }

  private updateMetaTagByName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name='${name}'`);
  }

  private updateMetaTagByProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private upsertLink(id: string, attributes: Record<string, string>): void {
    let linkElement = this.document.head.querySelector(`link[data-ef-seo='${id}']`) as HTMLLinkElement | null;

    if (!linkElement) {
      linkElement = this.document.createElement('link');
      linkElement.setAttribute('data-ef-seo', id);
      this.document.head.appendChild(linkElement);
    }

    for (const [name, value] of Object.entries(attributes)) {
      linkElement.setAttribute(name, value);
    }
  }

  private removeLink(id: string): void {
    const linkElement = this.document.head.querySelector(`link[data-ef-seo='${id}']`);
    if (linkElement) {
      linkElement.remove();
    }
  }
}
