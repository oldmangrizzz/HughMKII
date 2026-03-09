// HughTVApp.swift — tvOS target
// H.U.G.H. ambient intelligence display for Apple TV.
// This is the "passive intelligence display" — like JARVIS's ambient lab readout.
// The TV shows the state of the entire ecosystem without requiring interaction.

import SwiftUI

@main
struct HughTVApp: App {
    var body: some Scene {
        WindowGroup {
            HughAmbientView()
        }
    }
}
