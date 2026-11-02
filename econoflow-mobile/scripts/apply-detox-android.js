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

/** The app id, read from `app.json` — the test class lives in `<package>.test`. */
const APP_PACKAGE = require(path.join(projectRoot, 'app.json')).expo.android.package;

const APP_MARKER = 'Detox integration tests (e2e/): androidTest wiring';
const ROOT_MARKER = 'Detox integration tests (e2e/): library androidTest variants';

/**
 * The end marker of every block this script writes.
 *
 * Both start and end markers are checked, so a block written by an **older** version of this
 * script is replaced rather than treated as "already wired" — that is how the runner change
 * below would otherwise never reach an `android/` project that was wired before it.
 */
const markerEnd = (marker) => `// ${marker} (end)`;

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, contents) {
  fs.writeFileSync(file, contents, 'utf8');
}

/** Removes a block written by this script — or by a previous version of it. */
function stripBlock(contents, marker) {
  const start = contents.indexOf(`// ${marker}`);
  if (start === -1) {
    return contents;
  }
  const end = contents.indexOf(markerEnd(marker), start);
  const stop = end === -1 ? contents.length : end + markerEnd(marker).length;
  return `${contents.slice(0, start)}${contents.slice(stop)}`.replace(/\s+$/, '');
}

/**
 * Replaces (or appends) `block`, keeping one blank line before it, and reports whether the
 * file actually changed — so a second run leaves the file untouched.
 */
function appendBlock(contents, block, marker) {
  const next = `${stripBlock(contents, marker)}\n\n${block}\n`;
  return { contents: next, changed: next !== contents };
}

const appBuildGradle = path.join(androidRoot, 'app', 'build.gradle');
const rootBuildGradle = path.join(androidRoot, 'build.gradle');

if (!fs.existsSync(appBuildGradle)) {
  console.error('android/app/build.gradle not found — run `npx expo prebuild -p android` first.');
  process.exit(1);
}

const appBlock = `// ${APP_MARKER}
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
        // Detox's own runner, not the plain AndroidJUnitRunner. Detox talks to the device
        // over a WebSocket and declares its session in instrumentation arguments
        // (\`detoxSessionId\`, \`detoxServer\`); nothing runs a JUnit test that would consume
        // them, so under the plain runner the instrumentation finds **no tests**, exits, and
        // Detox fails every spec with "Failed to run application on the device". The class
        // ships in the com.wix:detox AAR (\`com.wix.detox.DetoxJUnitRunner\`), which is why it
        // resolves from the androidTest classpath alone.
        testInstrumentationRunner "com.wix.detox.DetoxJUnitRunner"
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
}
${markerEnd(APP_MARKER)}`;

const rootBlock = `// ${ROOT_MARKER}
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
}
${markerEnd(ROOT_MARKER)}`;

/**
 * Detox's test entry point, without which the suite cannot start.
 *
 * Detox connects to the app over a WebSocket and handshakes inside a JUnit test it runs
 * itself: the test calls `Detox.runTests(...)` with an activity rule, and that is what opens
 * the connection. Neither the `com.wix:detox` AAR nor the Appium-style "DetoxApp" activity
 * provides it, so the app has to own one. Without it the instrumentation still starts (the
 * runner is fine) but discovers no executable test — the log says
 * `TestRunner: run started: 1 tests` / `run finished: 0 tests` — exits with status 0, and
 * Detox reports "Failed to run application on the device" for every spec. This is what made
 * the suite fail on every machine, CI included.
 *
 * The rule names the app's real activity: Detox launches it by resolving the intent against
 * the app manifest (`ActivityTestRule.launchActivity`), so a placeholder would only fail later
 * with "Unable to resolve activity for: Intent { ... cmp=pt.econoflow.mobile/android.app.Activity }".
 */
const detoxTestSource = `package ${APP_PACKAGE}.test;

import androidx.test.internal.runner.junit4.AndroidJUnit4ClassRunner;
import androidx.test.rule.ActivityTestRule;

import com.wix.detox.Detox;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import ${APP_PACKAGE}.MainActivity;

/**
 * The single JUnit test the Detox runner executes.
 *
 * Drawn from Detox's own documentation (Detox.java's class comment): a runner that extends
 * AndroidJUnitRunner runs this test, the test holds the activity under test in a rule, and
 * Detox.runTests() drives the session from there. There is nothing to assert here — the
 * spec files in e2e/ are the tests; this is their entry point on the device.
 */
@RunWith(AndroidJUnit4ClassRunner.class)
public class DetoxTest {

    @Rule
    public ActivityTestRule<MainActivity> activityRule =
            new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        Detox.runTests(activityRule);
    }
}
`;

const detoxTestFile = path.join(
  androidRoot,
  'app',
  'src',
  'androidTest',
  'java',
  ...APP_PACKAGE.split('.'),
  'test',
  'DetoxTest.java',
);

const app = appendBlock(read(appBuildGradle), appBlock, APP_MARKER);
if (app.changed) write(appBuildGradle, app.contents);

const root = appendBlock(read(rootBuildGradle), rootBlock, ROOT_MARKER);
if (root.changed) write(rootBuildGradle, root.contents);

// The test class lives in its own file, so it is compared rather than appended.
const detoxTestChanged =
  !fs.existsSync(detoxTestFile) || read(detoxTestFile) !== detoxTestSource;
if (detoxTestChanged) {
  fs.mkdirSync(path.dirname(detoxTestFile), { recursive: true });
  write(detoxTestFile, detoxTestSource);
}

console.log(
  app.changed || root.changed || detoxTestChanged
    ? 'Detox wiring applied to android/'
    : 'Detox wiring already present in android/',
);
