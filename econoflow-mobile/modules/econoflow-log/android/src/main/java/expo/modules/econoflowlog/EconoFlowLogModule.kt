package expo.modules.econoflowlog

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The diagnostic trail's native sink (#1116).
 *
 * `Log.i` writes straight to logd, so a trail line survives whatever happens to the JavaScript
 * console, the dev-mode bridge, or the React tree — which is exactly the situation the trail
 * exists for. Read it with:
 *
 *     adb logcat -s EconoFlowTrace
 *
 * ## Why this shape
 *
 * The base class is `expo.modules.kotlin.modules.Module` — the one Expo's generated
 * `ExpoModulesPackageList.kt` types its map with (`Map<Class<out Module>, String?>`). Extending
 * anything else (for instance `io.github.expo.modules.v2.Module`) fails the build with a type
 * mismatch *in generated code*, which is a confusing way to learn that a module is not
 * registered. `expo-crypto` still ships one v2 module beside its v1 ones; the app's registry is
 * v1-shaped, so a local module must match it.
 *
 * The config that makes Expo find this class at all is `expo-module.config.json`:
 * `android.modules` must list it. Without that entry the class compiles into the APK and is
 * never registered — every call from JavaScript is then a silent no-op, which looks exactly
 * like "the log sink does not work".
 */
class EconoFlowLogModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EconoFlowLog")

    Function("log") { level: String, tag: String, message: String ->
      when (level) {
        "debug" -> Log.d(tag, message)
        "warn" -> Log.w(tag, message)
        "error" -> Log.e(tag, message)
        else -> Log.i(tag, message)
      }
      null
    }
  }
}
