// HughWatchApp.swift — watchOS target
// H.U.G.H. on your wrist. Complications, quick actions, and wrist-raised voice.

import SwiftUI
import WatchKit

@main
struct HughWatchApp: App {
    @WKApplicationDelegateAdaptor(HughWatchDelegate.self) var delegate

    var body: some Scene {
        WindowGroup {
            HughWatchView()
        }
    }
}

// MARK: - Watch App Delegate

final class HughWatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        // Start connectivity with iPhone
        // WatchSession.shared.start() — if including WatchSession from companionOS
    }
}
