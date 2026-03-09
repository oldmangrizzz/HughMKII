// ContentView.swift — H.U.G.H.
//
// Sovereign shared environment — the foam between digital and physical.
// Two intelligences (Grizz + H.U.G.H.) co-inhabit this space.
//
// Design philosophy: Voice first → Visual second → Touch when necessary
// Reference: Tony Stark's E-Scape, The Matrix Construct, The Holodeck

import SwiftUI
import SwiftData

// MARK: - Root

struct ContentView: View {
    @StateObject private var hugh = HUGHClient.shared
    @State private var voiceActive = false
    @State private var transcript = ""
    @State private var showMenu = false
    @State private var lastError: String?
    @State private var showError = false

    var body: some View {
        #if os(visionOS)
        visionOSEnvironment
        #elseif os(tvOS)
        Text("H.U.G.H. // tvOS")
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(hex: "#00000f"))
        #else
        escapeEnvironment
        #endif
    }

    // MARK: - E-Scape environment (iOS / macOS)

    private var escapeEnvironment: some View {
        ZStack {
            AmbientVoidView(isOnline: hugh.isOnline, processingQuery: hugh.processingQuery)
            HughPresenceLocus(isOnline: hugh.isOnline, isProcessing: hugh.processingQuery)
            VStack {
                HStack {
                    Spacer()
                    StatusBadges(hugh: hugh)
                        .padding(.top, topPadding)
                        .padding(.trailing, 20)
                }
                Spacer()
            }
            if !hugh.lastHughResponse.isEmpty {
                VStack {
                    Spacer()
                    HughResponseReadout(text: hugh.lastHughResponse)
                        .padding(.bottom, 120)
                }
            }
            VStack {
                Spacer()
                VoicePortalView(
                    isActive: $voiceActive,
                    transcript: $transcript,
                    onSubmit: { text in Task { await handleInput(text) } }
                )
                .padding(.bottom, bottomPadding)
            }
        }
        .ignoresSafeArea()
        .sheet(isPresented: $showMenu) { HughMenuSheet() }
        .alert("H.U.G.H. Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(lastError ?? "Unknown error")
        }
        .onAppear { hugh.startHealthPolling() }
        #if os(iOS)
        .gesture(
            DragGesture(minimumDistance: 50).onEnded { value in
                if value.translation.height < -50 { showMenu = true }
            }
        )
        #endif
    }

    // MARK: - visionOS

    #if os(visionOS)
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace

    private var visionOSEnvironment: some View {
        ZStack {
            AmbientVoidView(isOnline: hugh.isOnline, processingQuery: hugh.processingQuery)
            HughPresenceLocus(isOnline: hugh.isOnline, isProcessing: hugh.processingQuery)
            VStack {
                HStack { Spacer(); StatusBadges(hugh: hugh).padding() }
                Spacer()
                VoicePortalView(isActive: $voiceActive, transcript: $transcript) { text in
                    Task { await handleInput(text) }
                }
                .padding(.bottom, 40)
            }
        }
        .ignoresSafeArea()
        .onAppear {
            hugh.startHealthPolling()
            Task { await openImmersiveSpace(id: "WorkshopImmersiveSpace") }
        }
    }
    #endif

    // MARK: - Input

    private func handleInput(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        do {
            _ = try await hugh.query(text)
        } catch {
            lastError = error.localizedDescription
            showError = true
        }
        transcript = ""
    }

    private var topPadding: CGFloat {
        #if os(iOS)
        return 52
        #else
        return 20
        #endif
    }

    private var bottomPadding: CGFloat {
        #if os(iOS)
        return 40
        #else
        return 24
        #endif
    }
}

// MARK: - AmbientVoidView

struct AmbientVoidView: View {
    let isOnline: Bool
    let processingQuery: Bool

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                drawVoid(context: context, size: size, time: t)
            }
        }
        .background(Color(hex: "#00000f"))
    }

    private func drawVoid(context: GraphicsContext, size: CGSize, time: Double) {
        let cx = size.width / 2
        let cy = size.height / 2
        context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: "#00000f")))
        let whorls: [(Double, Double, Double, Double, Double)] = [
            (0.3, 0.25, 0.55, 0.07, 240),
            (-0.2, -0.3, 0.45, 0.05, 260),
            (0.1, -0.15, 0.35, 0.09, 220),
        ]
        for (dx, dy, rf, spd, hue) in whorls {
            let ox = cx + cos(time * spd) * size.width  * dx
            let oy = cy + sin(time * spd) * size.height * dy
            let r  = min(size.width, size.height) * rf
            let opacity = (isOnline ? 0.12 : 0.04) + (processingQuery ? 0.08 : 0)
            let gradient = Gradient(colors: [
                Color(hue: hue / 360, saturation: 0.8, brightness: 0.4).opacity(opacity),
                Color.clear
            ])
            context.fill(
                Path(ellipseIn: CGRect(x: ox - r, y: oy - r, width: r * 2, height: r * 2)),
                with: .radialGradient(gradient, center: CGPoint(x: ox, y: oy), startRadius: 0, endRadius: r)
            )
        }
    }
}

// MARK: - HughPresenceLocus

struct HughPresenceLocus: View {
    let isOnline: Bool
    let isProcessing: Bool

    var pulseFrequency: Double { isProcessing ? 3.0 : (isOnline ? 0.8 : 0.3) }
    var ringColor: Color { isProcessing ? Color(hex: "#00BFFF") : (isOnline ? Color(hex: "#0A84FF") : Color(hex: "#444466")) }

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate * pulseFrequency
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(size.width, size.height) * 0.38
                for i in 0..<4 {
                    let progress = (t + Double(i) / 4.0).truncatingRemainder(dividingBy: 1.0)
                    let r = maxR * progress
                    let opacity = (1.0 - progress) * (isOnline ? 0.6 : 0.2)
                    var path = Path()
                    path.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
                    context.stroke(path, with: .color(ringColor.opacity(opacity)), lineWidth: 1.5)
                }
                let cr: Double = isProcessing ? 8 : 5
                context.fill(
                    Path(ellipseIn: CGRect(x: cx - cr, y: cy - cr, width: cr * 2, height: cr * 2)),
                    with: .color(ringColor)
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - StatusBadges

struct StatusBadges: View {
    @ObservedObject var hugh: HUGHClient

    var body: some View {
        HStack(spacing: 8) {
            badge("HUGH", on: hugh.isOnline)
            badge("HA",   on: hugh.haConnected)
            badge("CVX",  on: hugh.convexConnected)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(.ultraThinMaterial, in: Capsule())
    }

    private func badge(_ label: String, on: Bool) -> some View {
        HStack(spacing: 4) {
            Circle().frame(width: 6, height: 6)
                .foregroundStyle(on ? Color.green : Color(hex: "#444444"))
            Text(label)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundStyle(on ? .white : Color(hex: "#666666"))
        }
    }
}

// MARK: - HughResponseReadout

struct HughResponseReadout: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: .light, design: .monospaced))
            .foregroundStyle(.white.opacity(0.85))
            .multilineTextAlignment(.center)
            .lineLimit(3)
            .padding(.horizontal, 32).padding(.vertical, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 20)
    }
}

// MARK: - VoicePortalView

struct VoicePortalView: View {
    @Binding var isActive: Bool
    @Binding var transcript: String
    let onSubmit: (String) -> Void

    #if !os(tvOS) && !os(watchOS)
    @StateObject private var speech = SpeechRecognizer()
    #endif
    @State private var amplitudes: [CGFloat] = Array(repeating: 2, count: 30)
    @State private var waveTimer: Timer?

    var body: some View {
        VStack(spacing: 12) {
            if !transcript.isEmpty {
                Text(transcript)
                    .font(.system(size: 13, weight: .light, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(2).padding(.horizontal, 40)
            }
            Canvas { context, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let bw: CGFloat = 3
                let sp = (size.width - bw * CGFloat(amplitudes.count)) / CGFloat(amplitudes.count + 1)
                for (i, amp) in amplitudes.enumerated() {
                    let x = sp + CGFloat(i) * (bw + sp)
                    let h = max(2, amp)
                    let rect = CGRect(x: x, y: cy - h / 2, width: bw, height: h)
                    context.fill(
                        Path(roundedRect: rect, cornerRadius: bw / 2),
                        with: .color(Color(hex: "#0A84FF").opacity(isActive ? 0.9 : 0.4))
                    )
                }
                _ = cx // suppress unused warning
            }
            .frame(height: 44, maxWidth: .infinity)
            .contentShape(Rectangle())
            .onTapGesture { toggleVoice() }
        }
    }

    private func toggleVoice() {
        #if !os(tvOS) && !os(watchOS)
        Task { @MainActor in
            if isActive {
                speech.stopRecording()
                isActive = false
                stopWave()
                if !transcript.isEmpty { onSubmit(transcript) }
            } else {
                guard await speech.requestAuthorization() else { return }
                do {
                    try speech.startRecording()
                    isActive = true
                    startWave()
                    for await _ in speech.$transcript.values {
                        transcript = speech.transcript
                        if !speech.isRecording { break }
                    }
                } catch {
                    print("SpeechRecognizer error: \(error)")
                }
            }
        }
        #endif
    }

    private func startWave() {
        waveTimer = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { _ in
            Task { @MainActor in amplitudes = (0..<30).map { _ in CGFloat.random(in: 4...32) } }
        }
    }
    private func stopWave() {
        waveTimer?.invalidate(); waveTimer = nil
        amplitudes = Array(repeating: 2, count: 30)
    }
}

// MARK: - HughMenuSheet

struct HughMenuSheet: View {
    @Environment(\.dismiss) private var dismiss
    private let modes: [(String, String, String)] = [
        ("Workshop",   "visionpro",                     "Spatial environment"),
        ("HA Control", "house.fill",                    "Home Assistant"),
        ("Memory",     "brain.head.profile",            "Episodic anchors"),
        ("Systems",    "server.rack",                   "Infrastructure"),
        ("Live",       "waveform.path.ecg",             "Live telemetry"),
        ("Comms",      "bubble.left.and.bubble.right",  "Communicate"),
    ]
    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#08001a").ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 14) {
                        ForEach(modes, id: \.0) { m in
                            Button {
                                dismiss()
                                // TODO: Route to \(m.0) view
                            } label: {
                                HStack(spacing: 16) {
                                    Image(systemName: m.1).font(.title2).frame(width: 36)
                                        .foregroundStyle(Color(hex: "#0A84FF"))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(m.0).font(.headline).foregroundStyle(.white)
                                        Text(m.2).font(.caption).foregroundStyle(.white.opacity(0.5))
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.3))
                                }
                                .padding(16)
                                .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(24)
                }
            }
            .navigationTitle("H.U.G.H.")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.foregroundStyle(.white)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Color hex convenience

extension Color {
    init(hex: String) {
        let raw = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let val = UInt64(raw, radix: 16) ?? 0
        self.init(
            red:   Double((val >> 16) & 0xFF) / 255,
            green: Double((val >>  8) & 0xFF) / 255,
            blue:  Double((val >>  0) & 0xFF) / 255
        )
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .modelContainer(for: Item.self, inMemory: true)
        .preferredColorScheme(.dark)
}
