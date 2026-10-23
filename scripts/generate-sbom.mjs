#!/usr/bin/env node
/**
 * Generates the CycloneDX Software Bill of Materials (SBOM) for an EconoFlow release.
 *
 * Why this exists: the Cyber Resilience Act (Regulation (EU) 2024/2847) requires the
 * manufacturer to answer "is this vulnerability affecting our product?" within 24 hours
 * of becoming aware of an actively exploited vulnerability (Article 14). That question
 * cannot be answered without an inventory of what the product actually contains, and it
 * is also an explicit input to the Annex VII technical documentation.
 *
 * There is no single tool that covers every population EconoFlow ships, so this script
 * merges four inventories into one CycloneDX document:
 *
 *   1. NuGet            — the .NET backend, via the CycloneDX .NET tool
 *   2. npm (web)        — easyfinance.client/package-lock.json
 *   3. npm (mobile)     — econoflow-mobile/package-lock.json
 *   4. Base images      — the FROM references of the Dockerfile, read from the source
 *                         (the Windows/IIS release target ships the same .NET assemblies,
 *                         so populating the image SBOM covers it too)
 *
 * Usage:
 *   node scripts/generate-sbom.mjs [--output <dir>] [--skip-nuget]
 *
 * The NuGet population requires the CycloneDX .NET tool and a working restore (including
 * access to the private fpssoftware.chassis feed). Pass --skip-nuget to build the npm and
 * image populations only, which is useful when running locally without feed credentials.
 *
 * Exit code is non-zero when a population that was asked for could not be inventoried, so
 * a release can never publish a partial SBOM without anyone noticing.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');

const CYCLONEDX_SPEC_VERSION = '1.6';

/** Resolves `--flag value` style arguments. */
function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`[sbom] --${name} requires a value`);
    process.exit(2);
  }
  return value;
}

const skipNuGet = process.argv.includes('--skip-nuget');
const outputDirectory = resolve(readArgument('output', join(repositoryRoot, 'sbom')));

/** Release identity, so an SBOM can be tied to the artefact it describes. */
function readReleaseMetadata() {
  const versionPath = join(repositoryRoot, 'easyfinance.client', 'src', 'assets', 'version.json');
  const clientVersion = existsSync(versionPath)
    ? JSON.parse(readFileSync(versionPath, 'utf8')).versionNumber
    : '0.0.0';

  const mobileVersionPath = join(repositoryRoot, 'econoflow-mobile', 'package.json');
  const mobileVersion = existsSync(mobileVersionPath)
    ? JSON.parse(readFileSync(mobileVersionPath, 'utf8')).version
    : '0.0.0';

  return {
    clientVersion,
    mobileVersion,
    commit: process.env.GITHUB_SHA || 'local',
  };
}

// ── npm ──────────────────────────────────────────────────────────────────────

/**
 * Walks a v3 `package-lock.json` and returns one CycloneDX component per resolved
 * install path. The same package can legitimately appear at several versions.
 */
function collectNpmComponents(projectDirectory, projectName) {
  const lockPath = join(repositoryRoot, projectDirectory, 'package-lock.json');
  if (!existsSync(lockPath)) {
    throw new Error(`${projectDirectory}/package-lock.json is missing; run npm ci first`);
  }

  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const components = [];

  for (const [installPath, entry] of Object.entries(lock.packages ?? {})) {
    if (installPath === '') continue; // The workspace root itself.
    if (entry.link || !entry.version) continue;

    const name = installPath.slice(installPath.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (!name) continue;

    components.push({
      type: 'library',
      // Scoped packages (@angular/core) must be percent-encoded in a purl namespace.
      'bom-ref': `pkg:npm/${encodeName(name)}@${entry.version}?project=${projectName}`,
      name,
      version: entry.version,
      purl: `pkg:npm/${encodeName(name)}@${entry.version}`,
      scope: entry.dev ? 'excluded' : 'required',
      properties: [
        { name: 'econoflow:project', value: projectName },
        { name: 'econoflow:development', value: entry.dev ? 'true' : 'false' },
      ],
    });
  }

  return components;
}

function encodeName(name) {
  return name.startsWith('@') ? `%40${name.slice(1)}` : name;
}

// ── Docker base images ──────────────────────────────────────────────────────

/**
 * Extracts the FROM references from the Dockerfile, including the `AS <stage>` name.
 * External images (not build stages) become CycloneDX `container` components, because
 * a base-image CVE is a shipped-product CVE when the final image descends from it.
 */
function collectBaseImageComponents() {
  const dockerfilePath = join(repositoryRoot, 'Dockerfile');
  if (!existsSync(dockerfilePath)) return [];

  const stages = new Map(); // stage name -> image
  const images = [];
  const fromPattern = /^\s*FROM\s+(\S+)(?:\s+AS\s+(\S+))?/gim;

  for (const match of readFileSync(dockerfilePath, 'utf8').matchAll(fromPattern)) {
    const [, image, stageName] = match;
    if (stageName) stages.set(stageName.toLowerCase(), image);
    images.push({ image });
  }

  const externallyPulled = new Set();
  for (const { image } of images) {
    if (stages.has(image.toLowerCase())) continue; // A reference to an earlier build stage.
    externallyPulled.add(image);
  }

  return [...externallyPulled].map((image) => ({
    type: 'container',
    'bom-ref': `pkg:docker/${toDockerPurl(image)}`,
    name: image,
    version: image.slice(image.lastIndexOf(':') + 1) || 'latest',
    purl: `pkg:docker/${toDockerPurl(image)}`,
    description: `Base image referenced by the EconoFlow Dockerfile: ${image}`,
    properties: [{ name: 'econoflow:population', value: 'base image' }],
  }));
}

/** Turns `mcr.microsoft.com/dotnet/aspnet:10.0` into `dotnet/aspnet@10.0?repository_url=...`. */
function toDockerPurl(image) {
  const [name, tag = 'latest'] = image.split(':');
  const segments = name.split('/');
  const registry = segments.length > 1 && (segments[0].includes('.') || segments[0].includes(':'))
    ? segments.shift()
    : null;
  const purl = `${segments.join('/')}@${tag}`;
  return registry ? `${purl}?repository_url=${registry}` : purl;
}

// ── NuGet ───────────────────────────────────────────────────────────────────

/**
 * Runs the CycloneDX .NET tool for the server project and adds its components to the
 * merged document. NuGet restore needs the private feed credentials, which the caller
 * supplies through the environment exactly as the build does.
 */
function collectNuGetComponents() {
  const serverProject = join(repositoryRoot, 'EasyFinance.Server', 'EasyFinance.Server.csproj');
  const nugetOutput = join(outputDirectory, 'nuget');

  const command = process.env.CYCLONEDX_TOOL_PATH || 'dotnet-CycloneDX';
  const result = spawnSync(
    command,
    [
      serverProject,
      '--output', nugetOutput,
      '--filename', 'econoflow-nuget.cdx.json',
      '--output-format', 'Json',
      '--spec-version', CYCLONEDX_SPEC_VERSION,
      '--exclude-test-projects',
      '--set-type', 'Application',
    ],
    // No shell: it would split `--set-name EconoFlow (NuGet)` on the embedded space.
    // The tool path comes from the environment or PATH and is invoked directly.
    { cwd: repositoryRoot, stdio: 'inherit' },
  );

  if (result.error) {
    throw new Error(
      `Could not run the CycloneDX .NET tool (${command}). Install it with: ` +
        `dotnet tool install --global CycloneDX --version 6.3.1`,
    );
  }

  if (result.status !== 0) {
    throw new Error(`CycloneDX .NET tool exited with ${result.status}`);
  }

  const bomPath = join(nugetOutput, 'econoflow-nuget.cdx.json');
  if (!existsSync(bomPath)) {
    throw new Error(`CycloneDX did not write ${bomPath}`);
  }

  const bom = JSON.parse(readFileSync(bomPath, 'utf8'));
  return (bom.components ?? []).map((component) => ({
    ...component,
    properties: [
      ...(component.properties ?? []),
      { name: 'econoflow:population', value: 'NuGet' },
    ],
  }));
}

// ── Merge ───────────────────────────────────────────────────────────────────

function uniqueByBomRef(components) {
  const seen = new Map();
  for (const component of components) {
    if (!component['bom-ref'] || seen.has(component['bom-ref'])) continue;
    seen.set(component['bom-ref'], component);
  }
  return [...seen.values()];
}

const metadata = readReleaseMetadata();
mkdirSync(outputDirectory, { recursive: true });

const populations = [];

try {
  const clients = [
    ...collectNpmComponents('easyfinance.client', 'easyfinance.client'),
    ...collectNpmComponents('econoflow-mobile', 'econoflow-mobile'),
  ];
  populations.push({ name: 'npm', count: clients.length });

  const images = collectBaseImageComponents();
  populations.push({ name: 'base image', count: images.length });

  let nuget = [];
  if (skipNuGet) {
    console.log('[sbom] --skip-nuget: the NuGet population is omitted from this SBOM.');
  } else {
    nuget = collectNuGetComponents();
    populations.push({ name: 'NuGet', count: nuget.length });
  }

  const components = uniqueByBomRef([...nuget, ...clients, ...images]);

  const serialNumber = randomUuid();
  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: CYCLONEDX_SPEC_VERSION,
    serialNumber: `urn:uuid:${serialNumber}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: {
        components: [
          { type: 'application', name: 'scripts/generate-sbom.mjs', group: 'EconoFlow' },
        ],
      },
      component: {
        type: 'application',
        'bom-ref': 'econoflow',
        name: 'EconoFlow',
        version: metadata.clientVersion,
        description:
          'EconoFlow budget-tracking application (ASP.NET Core API, Angular web client and ' +
          'React Native mobile apps). SBOM generated for Cyber Resilience Act Article 14 triage.',
        properties: [
          { name: 'econoflow:commit', value: metadata.commit },
          { name: 'econoflow:web-version', value: metadata.clientVersion },
          { name: 'econoflow:mobile-version', value: metadata.mobileVersion },
          { name: 'econoflow:sbom-populations', value: populations.map((p) => `${p.name}=${p.count}`).join(', ') },
        ],
      },
    },
    components,
  };

  const bomPath = join(outputDirectory, 'econoflow.cdx.json');
  writeFileSync(bomPath, JSON.stringify(bom, null, 2) + '\n', 'utf8');

  console.log(`[sbom] Wrote ${bomPath}`);
  for (const population of populations) {
    console.log(`[sbom]   ${population.name}: ${population.count} component(s)`);
  }
  console.log(`[sbom] Total: ${components.length} component(s)`);
} catch (error) {
  console.error(`[sbom] ${error.message}`);
  process.exit(1);
}

function randomUuid() {
  // crypto.randomUUID is available on every Node version this repository runs on,
  // but fall back so the script also works on older runners.
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const value = (Math.random() * 16) | 0;
        return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
      });
}
