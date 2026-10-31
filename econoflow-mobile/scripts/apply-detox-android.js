#!/usr/bin/env node
/**
 * Applies the Detox wiring to the generated Android project.
 *
 * `econoflow-mobile/android/` is not committed: it is produced by `npx expo prebuild`, which
 * rebuilds it from `app.json` and the templates of the installed packages. Anything added to
 * it by hand is therefore lost on the next prebuild — including the two things Detox needs:
 *
 * 1. the `androidTest` dependency that carries Detox's instrumentation runner, and
 * 2. the root-level rule that stops the *libraries'* androidTest variants from merging native
 *    libraries (their test APKs are never installed, and two of them ship `libc++_shared.so`
 *    twice, which fails the merge).
 *
 * This script is the single source of that wiring: the e2e build runs it after `prebuild`, so
 * a clean checkout, CI and a developer machine all get the same project. It is idempotent.
 *
 *   node scripts/apply-detox-android.js
 */
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(projectRoot, 'android');

const APP_MARKER = '// Detox integration tests (e2e/): androidTest wiring';
const ROOT_MARKER = '// Detox integration tests (e2e/): library androidTest variants';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, contents) {
  fs.writeFileSync(file, contents, 'utf8');
}

/** Inserts `block` at the end of `contents`, keeping one blank line before it. */
function appendBlock(contents, block, marker) {
  if (contents.includes(marker)) {
    return { contents, changed: false };
  }
  const trimmed = contents.replace(/\s+$/, '');
  return { contents: `${trimmed}\n\n${block}\n`, changed: true };
}

const appBuildGradle = path.join(androidRoot, 'app', 'build.gradle');
const rootBuildGradle = path.join(androidRoot, 'build.gradle');

if (!fs.existsSync(appBuildGradle)) {
  console.error('android/app/build.gradle not found — run `npx expo prebuild -p android` first.');
  process.exit(1);
}

const appBlock = `${APP_MARKER}
// Detox talks to the app through an instrumentation runner, which lives in the androidTest
// APK only — nothing of it ships with the app. The runner comes from the AAR the installed
// \`detox\` package carries; its version is read from that package so it cannot drift from the
// CLI that runs the suite.
def detoxVersion = {
    def packageJson = file(["node", "--print", "require.resolve('detox/package.json')"].execute(null, projectDir).text.trim())
    return new groovy.json.JsonSlurper().parseText(packageJson.text).version
}()

repositories {
    maven { url "$rootDir/../node_modules/detox/Detox-android" }
}

android {
    defaultConfig {
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        testInstrumentationRunnerArguments.useTestStore = 'false'
    }
}

dependencies {
    androidTestImplementation("com.wix:detox:\${detoxVersion}") {
        // The runner reflects into React Native's own classes, so it has to see the exact
        // artifact the app was compiled against rather than a second copy of its own.
        exclude group: 'com.facebook.react'
    }
    androidTestImplementation('junit:junit:4.13.2')
}`;

const rootBlock = `${ROOT_MARKER}
// Building the androidTest APKs makes every native library package under test merge the STL
// into its own *-androidTest variant too. A library that has libc++_shared.so twice (its own
// CMake build and react-android) fails that merge as a duplicate, and the library test APKs
// are never installed — only the app's androidTest APK holds Detox's runner. Declared on the
// root project so the rule exists before any module's variants are created.
allprojects {
  if (it.path != ':app') {
    it.tasks.matching { task -> task.name == 'mergeDebugAndroidTestNativeLibs' }.configureEach { task ->
      task.enabled = false
    }
  }
}`;

const app = appendBlock(read(appBuildGradle), appBlock, APP_MARKER);
if (app.changed) write(appBuildGradle, app.contents);

const root = appendBlock(read(rootBuildGradle), rootBlock, ROOT_MARKER);
if (root.changed) write(rootBuildGradle, root.contents);

console.log(
  app.changed || root.changed
    ? 'Detox wiring applied to android/'
    : 'Detox wiring already present in android/',
);
