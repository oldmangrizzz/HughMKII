// HughMainWindow.swift — macOS
//
// Full macOS window — the complete E-Scape environment on desktop.
// - Same AmbientVoidView background as iOS
// - Command palette (Cmd+K) instead of sidebar
// - Workshop accessible via WebView or native RealityKit (Apple Silicon)
// - Multi-window support for HA control, Workshop, Comms
// - Always-on-top toggle

import SwiftUI
import WebKit

#if os(macOS)

struct HughMainWindow: View {
    @StateObject private var hugh = HUGHClient.shared
    @State private var voiceActive = false
    @State private var transcript = ""
    @State private var showCommandPalette = false
    @State private var showWorkshop = false
    @State private var isAlwaysOnTop = false
    @State private var lastError: String?
    @State private var showError = false

    var body: some View {
        ZStack {
            AmbientVoidView(isOnline: hugh.isOnline, processingQuery: hugh.processingQuery)
            HughPresenceLocus(isOnline: hugh.isOnline, isProcessing: hugh.processingQuery)

            VStack {
                HStack {
                    Spacer()
                    HStack(spacing: 12) {
                        StatusBadges(hugh: hugh)
                        alwaysOnTopButton
                    }
                    .padding(.top, 20).padding(.trailing, 20)
                }
                Spacer()
            }

            if !hugh.lastHughResponse.isEmpty {
                VStack {
                    Spacer()
                    HughResponseReadout(text: hugh.lastHughResponse).padding(.bottom, 90)
                }
            }

            VStack {
                Spacer()
                VoicePortalView(
                    isActive: $voiceActive,
                    transcript: $transcript,
                    onSubmit: { text in Task { await handleInput(text) } }
                )
                .padding(.bottom, 24)
            }

            // Command palette overlay
            if showCommandPalette {
                commandPaletteOverlay
            }

            // Workshop sheet
            if showWorkshop {
                workshopOverlay
            }
        }
        .ignoresSafeArea()
        .frame(minWidth: 800, minHeight: 600)
        .background(Color(hex: "#00000f"))
        .alert("H.U.G.H. Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: { Text(lastError ?? "") }
        .onAppear {
            hugh.startHealthPolling()
        }
        .keyboardShortcut("k", modifiers: .command)
        .onReceive(NotificationCenter.default.publisher(for: .openCommandPalette)) { _ in
            showCommandPalette.toggle()
        }
    }

    // MARK: - Always-on-top button

    private var alwaysOnTopButton: some View {
        Button {
            isAlwaysOnTop.toggle()
            NSApp.windows.first { $0.title == "H.U.G.H." }?.level = isAlwaysOnTop ? .floating : .normal
        } label: {
            Image(systemName: isAlwaysOnTop ? "pin.fill" : "pin")
                .font(.system(size: 11))
                .foregroundStyle(isAlwaysOnTop ? Color.yellow : Color.white.opacity(0.4))
        }
        .buttonStyle(.plain)
        .help(isAlwaysOnTop ? "Unpin window" : "Keep window on top")
    }

    // MARK: - Command palette

    private var commandPaletteOverlay: some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture { showCommandPalette = false }
            VStack(spacing: 0) {
                // Search field
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.white.opacity(0.4))
                    TextField("Command or query...", text: $transcript)
                        .textFieldStyle(.plain)
                        .foregroundStyle(.white)
                        .font(.system(size: 16))
                        .onSubmit {
                            showCommandPalette = false
                            Task { await handleInput(transcript) }
                        }
                }
                .padding(16)
                .background(Color(hex: "#0d0020"), in: RoundedRectangle(cornerRadius: 12))

                // Command shortcuts
                VStack(spacing: 4) {
                    cmdItem("Enter Workshop", icon: "visionpro") { showWorkshop = true; showCommandPalette = false }
                    cmdItem("HA Control", icon: "house.fill")    { showCommandPalette = false /* TODO: open HA window */ }
                    cmdItem("System Status", icon: "server.rack") { Task { await handleInput("What is the current system status?") }; showCommandPalette = false }
                    cmdItem("Toggle All Lights", icon: "lightbulb.fill") { Task { try? await hugh.haToggle("light.all") }; showCommandPalette = false }
                }
                .padding(.top, 8)
            }
            .padding(24)
            .background(Color(hex: "#08001a"), in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.8), radius: 40)
            .frame(maxWidth: 560)
        }
    }

    private func cmdItem(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .frame(width: 20)
                    .foregroundStyle(Color(hex: "#0A84FF"))
                Text(title)
                    .foregroundStyle(.white)
                Spacer()
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Workshop overlay (WebView or RealityKit)

    private var workshopOverlay: some View {
        ZStack(alignment: .topTrailing) {
            MacWorkshopWebView()
                .ignoresSafeArea()
                .transition(.opacity)
            Button {
                showWorkshop = false
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .buttonStyle(.plain)
            .padding(20)
        }
    }

    // MARK: - Input handler

    private func handleInput(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        transcript = ""
        do {
            _ = try await hugh.query(text)
        } catch {
            lastError = error.localizedDescription
            showError = true
        }
    }
}

// MARK: - macOS Workshop WebView

private struct MacWorkshopWebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let wv = WKWebView()
        wv.load(URLRequest(url: URL(string: "https://workshop.grizzlymedicine.icu")!))
        return wv
    }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

// MARK: - Notification

extension Notification.Name {
    static let openCommandPalette = Notification.Name("openCommandPalette")
}

// MARK: - Color hex (macOS)
// Note: canonical Color(hex:) is in ContentView.swift.
// For standalone macOS target build, replicate the extension here.

#endif // os(macOS)
