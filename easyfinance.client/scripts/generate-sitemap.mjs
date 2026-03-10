import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const srcRoot = resolve(projectRoot, 'src');
const routingFilePath = resolve(srcRoot, 'app/features/app-routing.module.ts');
const prerenderRoutesPath = resolve(srcRoot, 'prerender-routes.txt');
const sitemapOutputPath = resolve(srcRoot, 'sitemap.xml');
const llmsOutputPath = resolve(srcRoot, 'llms.txt');
const llmsFullOutputPath = resolve(srcRoot, 'llms-full.txt');
const siteOrigin = (process.env.SITEMAP_SITE_URL || 'https://econoflow.pt').replace(/\/+$/g, '');

const routeMetadataByCanonicalPath = new Map([
  ['/', { priority: '1.0', changefreq: 'monthly' }],
  ['/privacy-policy', { priority: '0.5', changefreq: 'yearly' }],
  ['/use-terms', { priority: '0.5', changefreq: 'yearly' }],
  ['/contact-us', { priority: '0.5', changefreq: 'yearly' }],
  ['/offline', { priority: '0.2', changefreq: 'yearly' }]
]);

const routeMetadataOverrides = new Map([
  ['/pt', { priority: '0.9', changefreq: 'monthly' }]
]);

const defaultRouteMetadata = { priority: '0.6', changefreq: 'monthly' };
const excludedRoutePaths = new Set(['/how-to-create-budget', '/pt/how-to-create-budget']);

const llmsMetadataByCanonicalPath = new Map([
  ['/', {
    title: 'Home',
    summary: 'Product overview, feature highlights, and account creation entry points.'
  }],
  ['/privacy-policy', {
    title: 'Privacy Policy',
    summary: 'Personal data handling, legal rights, and GDPR alignment.'
  }],
  ['/use-terms', {
    title: 'Terms of Use',
    summary: 'Service rules, account responsibilities, and platform limitations.'
  }],
  ['/contact-us', {
    title: 'Contact Us',
    summary: 'Public contact form for support questions and feedback.'
  }],
  ['/offline', {
    title: 'Offline Mode',
    summary: 'Offline fallback experience with retry guidance.'
  }]
]);

const defaultLlmsMetadata = {
  title: 'Public Page',
  summary: 'Publicly accessible EconoFlow page.'
};
const candidateComponentExtensions = ['.ts', '.html', '.css', '.scss'];
const translatedContentFiles = [
  resolve(srcRoot, 'assets/i18n/messages.en.json'),
  resolve(srcRoot, 'assets/i18n/messages.pt.json')
];

function normalizeRoutePath(routePath) {
  const trimmed = routePath.trim();
  if (!trimmed) {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailingSlashes = withLeadingSlash.replace(/\/+$/g, '');
  return withoutTrailingSlashes || '/';
}

function canonicalizeRoutePath(routePath) {
  if (routePath === '/pt') {
    return '/';
  }

  if (routePath.startsWith('/pt/')) {
    const localizedPath = routePath.slice('/pt'.length);
    return normalizeRoutePath(localizedPath);
  }

  return routePath;
}

function readPrerenderRoutes() {
  const fileContents = readFileSync(prerenderRoutesPath, 'utf8');
  const routePaths = [];
  const seen = new Set();

  for (const line of fileContents.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalized = normalizeRoutePath(trimmed);
    if (excludedRoutePaths.has(normalized)) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    routePaths.push(normalized);
  }

  return routePaths;
}

function readRoutingFileMappings() {
  const routingFileContents = readFileSync(routingFilePath, 'utf8');
  const componentImportBaseByName = new Map();
  const componentNameByPath = new Map();

  const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*'([^']+)';/g;
  let importMatch = importRegex.exec(routingFileContents);
  while (importMatch) {
    const importedSymbols = importMatch[1]
      .split(',')
      .map(symbol => symbol.trim())
      .filter(Boolean);
    const importPath = importMatch[2];
    const resolvedImportPath = resolve(dirname(routingFilePath), importPath);

    for (const importedSymbol of importedSymbols) {
      const symbolName = importedSymbol.split(/\s+as\s+/i)[0]?.trim();
      if (!symbolName || !symbolName.endsWith('Component')) {
        continue;
      }

      componentImportBaseByName.set(symbolName, resolvedImportPath);
    }

    importMatch = importRegex.exec(routingFileContents);
  }

  for (const line of routingFileContents.split(/\r?\n/g)) {
    if (!line.includes('path:') || !line.includes('component:')) {
      continue;
    }

    const routeMatch = line.match(/path:\s*'([^']*)'.*component:\s*([A-Za-z0-9_]+)/);
    if (!routeMatch) {
      continue;
    }

    const rawPath = routeMatch[1];
    const componentName = routeMatch[2];
    if (rawPath === '**' || rawPath.includes(':')) {
      continue;
    }

    const normalizedPath = normalizeRoutePath(rawPath);
    if (!componentNameByPath.has(normalizedPath)) {
      componentNameByPath.set(normalizedPath, componentName);
    }
  }

  return { componentImportBaseByName, componentNameByPath };
}

function resolveComponentSourceFiles(componentImportBaseByName, componentNameByPath, routePath) {
  const canonicalRoutePath = canonicalizeRoutePath(routePath);
  const componentName = componentNameByPath.get(canonicalRoutePath);
  if (!componentName) {
    return [];
  }

  const importBasePath = componentImportBaseByName.get(componentName);
  if (!importBasePath) {
    return [];
  }

  const componentFiles = [];
  for (const extension of candidateComponentExtensions) {
    const filePath = `${importBasePath}${extension}`;
    if (existsSync(filePath)) {
      componentFiles.push(filePath);
    }
  }

  const includesTranslateArtifacts = componentFiles.some(filePath => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.html')) {
      return false;
    }

    const contents = readFileSync(filePath, 'utf8');
    return contents.includes('TranslateModule')
      || contents.includes('TranslateService')
      || contents.includes('| translate')
      || contents.includes('translate.get(');
  });

  if (includesTranslateArtifacts) {
    componentFiles.push(...translatedContentFiles.filter(filePath => existsSync(filePath)));
  }

  return componentFiles;
}

function getGitCommitDate(filePath) {
  const relativePath = relative(projectRoot, filePath).replace(/\\/g, '/');
  const gitResult = spawnSync(
    'git',
    ['log', '-1', '--format=%cI', '--', relativePath],
    { cwd: projectRoot, encoding: 'utf8' }
  );

  if (gitResult.status !== 0) {
    return null;
  }

  const commitDate = gitResult.stdout.trim();
  if (!commitDate) {
    return null;
  }

  const parsedDate = new Date(commitDate);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function hasLocalChanges(filePath) {
  const relativePath = relative(projectRoot, filePath).replace(/\\/g, '/');
  const gitStatusResult = spawnSync(
    'git',
    ['status', '--porcelain', '--', relativePath],
    { cwd: projectRoot, encoding: 'utf8' }
  );

  if (gitStatusResult.status !== 0) {
    return false;
  }

  return gitStatusResult.stdout.trim().length > 0;
}

function getFileDate(filePath) {
  if (existsSync(filePath) && hasLocalChanges(filePath)) {
    return statSync(filePath).mtime;
  }

  const gitDate = getGitCommitDate(filePath);
  if (gitDate) {
    return gitDate;
  }

  if (existsSync(filePath)) {
    return statSync(filePath).mtime;
  }

  return null;
}

function formatAsSitemapIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toAbsoluteUrl(routePath) {
  if (routePath === '/') {
    return `${siteOrigin}/`;
  }

  return `${siteOrigin}${routePath}`;
}

function getRouteMetadata(routePath) {
  const directOverride = routeMetadataOverrides.get(routePath);
  if (directOverride) {
    return directOverride;
  }

  const canonicalPath = canonicalizeRoutePath(routePath);
  return routeMetadataByCanonicalPath.get(canonicalPath) || defaultRouteMetadata;
}

function getLlmsMetadata(routePath) {
  const canonicalPath = canonicalizeRoutePath(routePath);
  const baseMetadata = llmsMetadataByCanonicalPath.get(canonicalPath) || defaultLlmsMetadata;
  const isPortugueseRoute = routePath === '/pt' || routePath.startsWith('/pt/');

  if (!isPortugueseRoute) {
    return baseMetadata;
  }

  return {
    title: `${baseMetadata.title} (PT)`,
    summary: `Portuguese localized page for ${baseMetadata.summary}`
  };
}

function buildSitemapXml(routeEntries) {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ''
  ];

  for (const entry of routeEntries) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    lines.push(`    <priority>${entry.priority}</priority>`);
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push('  </url>');
    lines.push('');
  }

  lines.push('</urlset>');
  lines.push('');
  return lines.join('\n');
}

function buildLlmsTxt(routeEntries) {
  const englishEntries = routeEntries.filter(entry => !(entry.routePath === '/pt' || entry.routePath.startsWith('/pt/')));
  const portugueseEntries = routeEntries.filter(entry => entry.routePath === '/pt' || entry.routePath.startsWith('/pt/'));

  const lines = [
    '# EconoFlow',
    '',
    '> EconoFlow is an open-source web application for personal and collaborative finance management.',
    '',
    '## Public Pages',
    ...englishEntries.map(entry => {
      const metadata = getLlmsMetadata(entry.routePath);
      return `- [${metadata.title}](${entry.loc}): ${metadata.summary}`;
    }),
    '',
    '## Public Pages (Portuguese)',
    ...portugueseEntries.map(entry => {
      const metadata = getLlmsMetadata(entry.routePath);
      return `- [${metadata.title}](${entry.loc}): ${metadata.summary}`;
    }),
    '',
    '## Machine-Readable Endpoints',
    `- [Sitemap](${siteOrigin}/sitemap.xml): XML sitemap generated from public routes and source update history.`,
    `- [LLMs Full](${siteOrigin}/llms-full.txt): Full route catalog including last modified timestamps.`,
    `- [Robots](${siteOrigin}/robots.txt): Crawl allow/disallow directives for the site.`,
    ''
  ];

  return lines.join('\n');
}

function buildLlmsFullTxt(routeEntries) {
  const lines = [
    '# EconoFlow - LLMs Full',
    '',
    'This file is generated from public route definitions and source-file update history.',
    '',
    '## Public Route Catalog'
  ];

  for (const entry of routeEntries) {
    const metadata = getLlmsMetadata(entry.routePath);
    lines.push(`- [${metadata.title}](${entry.loc}): ${metadata.summary} Canonical path: \`${entry.routePath}\`. Last updated: \`${entry.lastmod}\`.`);
  }

  lines.push('');
  lines.push('## Supporting Endpoints');
  lines.push(`- [Sitemap](${siteOrigin}/sitemap.xml): XML route index for search engines and crawlers.`);
  lines.push(`- [Robots](${siteOrigin}/robots.txt): Crawl guidance and disallowed private paths.`);
  lines.push('');

  return lines.join('\n');
}

function generateSitemap() {
  const routes = readPrerenderRoutes();
  if (routes.length === 0) {
    throw new Error(`No routes found in ${prerenderRoutesPath}`);
  }

  const { componentImportBaseByName, componentNameByPath } = readRoutingFileMappings();
  const routeEntries = [];

  for (const routePath of routes) {
    const sourceFiles = resolveComponentSourceFiles(componentImportBaseByName, componentNameByPath, routePath);
    if (sourceFiles.length === 0) {
      console.warn(`[sitemap] Route "${routePath}" has no resolved component files. Falling back to routing file date.`);
      sourceFiles.push(routingFilePath);
    }

    const uniqueFiles = [...new Set(sourceFiles)];
    const dates = uniqueFiles
      .map(getFileDate)
      .filter(date => date !== null);

    if (dates.length === 0) {
      throw new Error(`No timestamp source files found for route "${routePath}".`);
    }

    const latestDate = new Date(Math.max(...dates.map(date => date.getTime())));
    const metadata = getRouteMetadata(routePath);

    routeEntries.push({
      routePath,
      loc: toAbsoluteUrl(routePath),
      lastmod: formatAsSitemapIso(latestDate),
      priority: metadata.priority,
      changefreq: metadata.changefreq
    });
  }

  const sitemapXml = buildSitemapXml(routeEntries);
  const llmsTxt = buildLlmsTxt(routeEntries);
  const llmsFullTxt = buildLlmsFullTxt(routeEntries);

  writeFileSync(sitemapOutputPath, sitemapXml, 'utf8');
  writeFileSync(llmsOutputPath, llmsTxt, 'utf8');
  writeFileSync(llmsFullOutputPath, llmsFullTxt, 'utf8');

  console.log(`[sitemap] Generated ${routeEntries.length} entries at ${relative(projectRoot, sitemapOutputPath)}`);
  console.log(`[sitemap] Generated ${relative(projectRoot, llmsOutputPath)} and ${relative(projectRoot, llmsFullOutputPath)}`);
}

generateSitemap();
