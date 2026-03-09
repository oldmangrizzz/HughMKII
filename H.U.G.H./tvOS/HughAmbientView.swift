// HughAmbientView.swift — tvOS
//
// Full-screen ambient display of H.U.G.H.'s intelligence and home state.
// Layout:
//   - Full-screen animated void background
//   - Large center: current H.U.G.H. status / last message
//   - Bottom bar: HA entity states
//   - Top right: clock + "H.U.G.H. // ONLINE"
//   - Particle/ring animation reacting to HA events
//
// Siri Remote:
//   Select  → activate voice query
//   Menu    → show full status overlay
//   Play/Pause → Workshop live feed toggle

import SwiftUI

struct HughAmbientView: View {
    @StateObject private var hugh = HUGHClient.shared
    @State private var showStatusOverlay = false
    @State private var showWorkshopFeed = false
    @State private var currentTime = Date()
    @State private var clockTimer: Timer?

    var body: some View {
        ZStack {
            // Background void
            tvAmbientBackground

            // Center: H.U.G.H. status + last message
            VStack(spacing: 32) {
                Spacer()
                tvPresenceLocus
                if !hugh.lastHughResponse.isEmpty {
                    Text(hugh.lastHughResponse)
                        .font(.system(size: 36, weight: .thin, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.9))
                        .multilineTextAlignment(.center)
                        .lineLimit(4)
                        .padding(.horizontal, 120)
                        .transition(.opacity.animation(.easeIn(duration: 0.8)))
                }
                Spacer()
            }

            // Top-right: clock + status
            VStack {
                HStack {
                    Spacer()
                    tvStatusBar
                        .padding(.top, 48)
                        .padding(.trailing, 60)
                }
                Spacer()
            }

            // Bottom bar: HA entity states
            VStack {
                Spacer()
                tvEntityBar
                    .padding(.bottom, 40)
            }

            // Workshop live feed overlay
            if showWorkshopFeed {
                WorkshopLiveFeed()
                    .transition(.opacity)
            }

            // Full status overlay (Menu button)
            if showStatusOverlay {
                tvStatusOverlay
            }
        }
        .ignoresSafeArea()
        .onAppear {
            hugh.startHealthPolling()
            clockTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                currentTime = Date()
            }
        }
        .onDisappear {
            clockTimer?.invalidate()
            hugh.stopHealthPolling()
        }
        // Siri Remote focus handling — use onMoveCommand / onPlayPauseCommand
        .onPlayPauseCommand { showWorkshopFeed.toggle() }
        .focusable()
    }

    // MARK: - Sub-views

    private var tvAmbientBackground: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let cx = size.width / 2
                let cy = size.height / 2
                context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: "#00000f")))
                let whorls: [(Double, Double, Double, Double, Double)] = [
                    (0.3, 0.2, 0.7, 0.05, 240),
                    (-0.25, -0.3, 0.6, 0.04, 260),
                    (0.1, -0.2, 0.5, 0.07, 220),
                    (-0.1, 0.15, 0.4, 0.06, 200),
                ]
                for (dx, dy, rf, spd, hue) in whorls {
                    let ox = cx + cos(t * spd) * size.width * dx
                    let oy = cy + sin(t * spd) * size.height * dy
                    let r  = min(size.width, size.height) * rf
                    let base = hugh.isOnline ? 0.14 : 0.05
                    let boost = hugh.processingQuery ? 0.08 : 0
                    let gradient = Gradient(colors: [
                        Color(hue: hue / 360, saturation: 0.8, brightness: 0.4).opacity(base + boost),
                        Color.clear
                    ])
                    context.fill(
                        Path(ellipseIn: CGRect(x: ox - r, y: oy - r, width: r * 2, height: r * 2)),
                        with: .radialGradient(gradient, center: CGPoint(x: ox, y: oy), startRadius: 0, endRadius: r)
                    )
                }
            }
        }
        .background(Color(hex: "#00000f"))
    }

    private var tvPresenceLocus: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let freq = hugh.processingQuery ? 3.0 : (hugh.isOnline ? 0.8 : 0.3)
                let phase = t * freq
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(size.width, size.height) * 0.45
                let color: Color = hugh.processingQuery ? Color(hex: "#00BFFF")
                    : (hugh.isOnline ? Color(hex: "#0A84FF") : Color(hex: "#334"))
                for i in 0..<6 {
                    let progress = (phase + Double(i) / 6.0).truncatingRemainder(dividingBy: 1.0)
                    let r = maxR * progress
                    let opacity = (1.0 - progress) * (hugh.isOnline ? 0.5 : 0.15)
                    var p = Path()
                    p.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
                    context.stroke(p, with: .color(color.opacity(opacity)), lineWidth: 2)
                }
                let cr: Double = hugh.processingQuery ? 16 : 10
                context.fill(
                    Path(ellipseIn: CGRect(x: cx - cr, y: cy - cr, width: cr * 2, height: cr * 2)),
                    with: .color(color)
                )
            }
        }
        .frame(width: 300, height: 300)
    }

    private var tvStatusBar: some View {
        VStack(alignment: .trailing, spacing: 6) {
            Text(currentTime.formatted(.dateTime.hour().minute().second()))
                .font(.system(size: 22, weight: .thin, design: .monospaced))
                .foregroundStyle(.white.opacity(0.6))
            HStack(spacing: 8) {
                Text("H.U.G.H.")
                    .font(.system(size: 16, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.8))
                Text("//")
                    .foregroundStyle(.white.opacity(0.3))
                Text(hugh.isOnline ? "ONLINE" : "OFFLINE")
                    .font(.system(size: 16, weight: .bold, design: .monospaced))
                    .foregroundStyle(hugh.isOnline ? Color.green : Color.red)
            }
        }
    }

    private var tvEntityBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 20) {
                ForEach(hugh.haStates.prefix(12)) { state in
                    HAEntityRow(state: state)
                }
            }
            .padding(.horizontal, 60)
        }
        .frame(height: 80)
        .background(.ultraThinMaterial.opacity(0.6))
    }

    private var tvStatusOverlay: some View {
        ZStack {
            Color.black.opacity(0.8).ignoresSafeArea()
            VStack(spacing: 24) {
                Text("H.U.G.H. // SYSTEMS")
                    .font(.system(size: 48, weight: .thin, design: .monospaced))
                    .foregroundStyle(.white)
                Divider().background(.white.opacity(0.3))
                LazyVGrid(columns: Array(repeating: .init(.flexible()), count: 3), spacing: 16) {
                    ForEach(hugh.haStates.prefix(9)) { state in
                        HAEntityRow(state: state, expanded: true)
                    }
                }
                .padding(.horizontal, 80)
                Text("Press MENU to dismiss")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .onExitCommand { showStatusOverlay = false }
    }
}

// MARK: - Color hex (tvOS copy — same as ContentView extension)

extension Color {
    // Defined here for tvOS target independence
    // If building as single multiplatform target, remove this and use the one in ContentView.swift
    init(hex s: String) {
        let raw = s.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let val = UInt64(raw, radix: 16) ?? 0
        self.init(
            red:   Double((val >> 16) & 0xFF) / 255,
            green: Double((val >>  8) & 0xFF) / 255,
            blue:  Double((val >>  0) & 0xFF) / 255
        )
    }
}

#Preview {
    HughAmbientView()
        .preferredColorScheme(.dark)
}
