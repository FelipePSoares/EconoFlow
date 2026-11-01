import ExpoModulesCore
import Foundation
import os.log

/**
 * The diagnostic trail's native sink on iOS.
 *
 * `NSLog` goes to the device console (`idevicesyslog`, Console.app, Xcode), where a JavaScript
 * `console.*` from this app does not.
 */
public class EconoFlowLogModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EconoFlowLog")

    Function("log") { (level: String, tag: String, message: String) in
      let line = "[\(tag)] \(message)"
      if #available(iOS 14.0, *) {
        let logger = Logger(subsystem: tag, category: level)
        switch level {
        case "debug": logger.debug("\(line, privacy: .public)")
        case "warn": logger.warning("\(line, privacy: .public)")
        case "error": logger.error("\(line, privacy: .public)")
        default: logger.info("\(line, privacy: .public)")
        }
      } else {
        NSLog("%@", line)
      }
    }
  }
}
