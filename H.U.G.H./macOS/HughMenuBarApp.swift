// HughMenuBarApp.swift — macOS
//
// H.U.G.H. lives in your menu bar.
// - Status icon: filled circle (online) / empty circle (offline)
// - Click: popover with quick status + voice input
// - Keyboard shortcut: Cmd+Shift+H = activate H.U.G.H. voice
// - Always-on-top option for the main window

import SwiftUI
import AppKit

#if os(macOS)

final class HughMenuBarController: NSObject, ObservableObject {
    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var eventMonitor: Any?

    @Published var isPopoverShown = false

    func setup() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem = item

        if let button = item.button {
            button.image = NSImage(systemSymbolName: "circle", accessibilityDescription: "H.U.G.H.")
            button.image?.isTemplate = true
            button.action = #selector(togglePopover)
            button.target = self
        }

        let pop = NSPopover()
        pop.contentSize = NSSize(width: 320, height: 400)
        pop.behavior = .transient
        pop.contentViewController = NSHostingController(
            rootView: HughMenuBarPopover()
                .environmentObject(HUGHClient.shared)
        )
        popover = pop

        // Global keyboard shortcut: Cmd+Shift+H
        NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.modifierFlags.contains([.command, .shift]) && event.keyCode == 4 { // H
                self?.togglePopover()
            }
        }

        // Update icon based on online status
        NotificationCenter.default.addObserver(forName: .hughOnlineStatusChanged, object: nil, queue: .main) { [weak self] notification in
            let online = notification.userInfo?["online"] as? Bool ?? false
            self?.updateIcon(online: online)
        }
    }

    @objc func togglePopover() {
        guard let button = statusItem?.button, let pop = popover else { return }
        if pop.isShown {
            pop.performClose(nil)
            isPopoverShown = false
        } else {
            pop.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            isPopoverShown = true
        }
    }

    func updateIcon(online: Bool) {
        let name = online ? "circle.fill" : "circle"
        statusItem?.button?.image = NSImage(systemSymbolName: name, accessibilityDescription: "H.U.G.H.")
    }
}

// MARK: - Menu Bar Popover

struct HughMenuBarPopover: View {
    @EnvironmentObject var hugh: HUGHClient
    @StateObject private var speechRec = SpeechRecognizer()
    @State private var voiceText = ""
    @State private var isListening = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            ZStack {
                Color(hex: "#08001a")
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("H.U.G.H.")
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                        HStack(spacing: 6) {
                            Circle().frame(width: 6, height: 6)
                                .foregroundStyle(hugh.isOnline ? Color.green : Color.red)
                            Text(hugh.isOnline ? "ONLINE" : "OFFLINE")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(hugh.isOnline ? .green : .red)
                        }
                    }
                    Spacer()
                    // Open main window
                    Button {
                        NSApp.windows.first { $0.title == "H.U.G.H." }?.makeKeyAndOrderFront(nil)
                        NSApp.activate(ignoringOtherApps: true)
                    } label: {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
            }
            .frame(height: 70)

            Divider().background(Color.white.opacity(0.1))

            // Quick status
            ScrollView {
                VStack(spacing: 10) {
                    // HA entities summary
                    ForEach(hugh.haStates.prefix(6)) { state in
                        menuBarEntityRow(state)
                    }
                }
                .padding(12)
            }
            .frame(maxHeight: 200)
            .background(Color(hex: "#04000d"))

            Divider().background(Color.white.opacity(0.1))

            // Last response
            if !hugh.lastHughResponse.isEmpty {
                Text(hugh.lastHughResponse)
                    .font(.system(size: 11, weight: .light))
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(2)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(hex: "#080015"))
            }

            Divider().background(Color.white.opacity(0.1))

            // Voice input
            HStack(spacing: 10) {
                TextField("Ask H.U.G.H...", text: $voiceText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .foregroundStyle(.white)
                    .onSubmit { submitQuery() }
                Button {
                    toggleVoice()
                } label: {
                    Image(systemName: isListening ? "stop.circle.fill" : "mic.fill")
                        .foregroundStyle(isListening ? .red : Color(hex: "#0A84FF"))
                }
                .buttonStyle(.plain)
                Button("Send") { submitQuery() }
                    .buttonStyle(.plain)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color(hex: "#0A84FF"))
                    .disabled(voiceText.isEmpty && !isListening)
            }
            .padding(12)
            .background(Color(hex: "#04000d"))
        }
        .background(Color(hex: "#08001a"))
        .preferredColorScheme(.dark)
        .onAppear { hugh.startHealthPolling() }
    }

    private func menuBarEntityRow(_ state: HAState) -> some View {
        let friendly = (state.attributes["friendly_name"]?.value as? String)
            ?? String(state.entity_id.split(separator: ".").last ?? "")
        let isOn = ["on", "home", "open", "playing"].contains(state.state.lowercased())
        return HStack {
            Circle().frame(width: 6, height: 6)
                .foregroundStyle(isOn ? Color.green : Color(red: 0.25, green: 0.25, blue: 0.35))
            Text(friendly)
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.75))
                .lineLimit(1)
            Spacer()
            Text(state.state)
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(.white.opacity(0.4))
        }
    }

    private func submitQuery() {
        let q = voiceText
        voiceText = ""
        Task { try? await hugh.query(q) }
    }

    private func toggleVoice() {
        Task { @MainActor in
            if isListening {
                speechRec.stopRecording()
                isListening = false
                let text = speechRec.transcript
                if !text.isEmpty {
                    voiceText = text
                    submitQuery()
                }
            } else {
                guard await speechRec.requestAuthorization() else { return }
                try? speechRec.startRecording()
                isListening = true
                for await _ in speechRec.$transcript.values {
                    voiceText = speechRec.transcript
                    if !speechRec.isRecording { break }
                }
                isListening = false
            }
        }
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let hughOnlineStatusChanged = Notification.Name("hughOnlineStatusChanged")
}

// MARK: - Color hex (macOS copy)

extension Color {
    // Defined here for macOS target independence.
    // Remove if building as single multiplatform target (ContentView.swift has the canonical extension).
    init(hexMac s: String) {
        let raw = s.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let val = UInt64(raw, radix: 16) ?? 0
        self.init(
            red:   Double((val >> 16) & 0xFF) / 255,
            green: Double((val >>  8) & 0xFF) / 255,
            blue:  Double((val >>  0) & 0xFF) / 255
        )
    }
}

#endif // os(macOS)
