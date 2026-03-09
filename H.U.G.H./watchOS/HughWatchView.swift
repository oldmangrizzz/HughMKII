// HughWatchView.swift — watchOS
//
// Primary watch view for H.U.G.H.
// Layout:
//   Top:    Status dot (green=online, red=offline)
//   Center: Last H.U.G.H. message (2 lines, truncated)
//   Bottom: 3 quick action buttons
//   Digital Crown: scroll through recent HA events
//
// Voice: raise wrist → Digital Crown press activates voice query
// Haptics: pulse when H.U.G.H. sends a message or HA event fires

import SwiftUI
import WatchKit

struct HughWatchView: View {
    @StateObject private var client = WatchHUGHClient.shared
    @State private var showEventScroll = false
    @State private var voiceQuery = ""
    @State private var showVoiceInput = false
    @State private var crownValue: Double = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    statusHeader
                    responseCard
                    quickActions
                    if !client.recentEvents.isEmpty {
                        eventList
                    }
                }
                .padding(.horizontal, 4)
            }
            .navigationTitle("H.U.G.H.")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear { client.startPolling() }
        .sheet(isPresented: $showVoiceInput) { voiceInputSheet }
    }

    // MARK: - Sub-views

    private var statusHeader: some View {
        HStack(spacing: 8) {
            Circle()
                .frame(width: 8, height: 8)
                .foregroundStyle(client.isOnline ? Color.green : Color.red)
            Text(client.isOnline ? "ONLINE" : "OFFLINE")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(client.isOnline ? .green : .red)
            Spacer()
            Button(action: { showVoiceInput = true }) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 4)
    }

    private var responseCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            if client.isProcessing {
                HStack(spacing: 6) {
                    ProgressView().progressViewStyle(.circular).scaleEffect(0.6)
                    Text("H.U.G.H. thinking...")
                        .font(.system(size: 11, weight: .light, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.5))
                }
            } else if !client.lastResponse.isEmpty {
                Text(client.lastResponse)
                    .font(.system(size: 12, weight: .light))
                    .foregroundStyle(.white.opacity(0.9))
                    .lineLimit(3)
            } else {
                Text("Awaiting H.U.G.H. response...")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.35))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private var quickActions: some View {
        HStack(spacing: 8) {
            QuickActionButton(
                icon: "house.fill",
                label: "Home",
                color: .blue
            ) { Task { try? await client.sendQuickAction(.homeScene) } }

            QuickActionButton(
                icon: "lightbulb.fill",
                label: "Lights",
                color: .yellow
            ) { Task { try? await client.sendQuickAction(.toggleLights) } }

            QuickActionButton(
                icon: "waveform.path.ecg",
                label: "Status",
                color: .green
            ) { Task { try? await client.sendQuickAction(.systemStatus) } }
        }
    }

    private var eventList: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("RECENT EVENTS")
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.3))
                .padding(.leading, 4)
            ForEach(client.recentEvents.prefix(5)) { event in
                watchEventRow(event)
            }
        }
    }

    private func watchEventRow(_ event: HAEvent) -> some View {
        HStack(spacing: 8) {
            Circle()
                .frame(width: 5, height: 5)
                .foregroundStyle(Color.blue.opacity(0.7))
            Text(event.description)
                .font(.system(size: 10))
                .foregroundStyle(.white.opacity(0.6))
                .lineLimit(1)
        }
        .padding(.horizontal, 4)
    }

    private var voiceInputSheet: some View {
        VStack(spacing: 16) {
            Image(systemName: "mic.fill")
                .font(.system(size: 36))
                .foregroundStyle(.blue)
            Text("Speak to H.U.G.H.")
                .font(.headline)
            TextField("Query...", text: $voiceQuery)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
            Button("Send") {
                let q = voiceQuery
                showVoiceInput = false
                voiceQuery = ""
                Task { try? await client.query(q) }
            }
            .disabled(voiceQuery.isEmpty)
        }
        .padding()
    }
}

// MARK: - WatchHUGHClient
// Lightweight watch-side client. Sends commands through WatchConnectivity to iPhone,
// or directly to H.U.G.H. API when on WiFi.

@MainActor
final class WatchHUGHClient: ObservableObject {
    static let shared = WatchHUGHClient()

    @Published var isOnline = false
    @Published var isProcessing = false
    @Published var lastResponse = ""
    @Published var recentEvents: [HAEvent] = []

    enum QuickAction { case homeScene, toggleLights, systemStatus }

    private var pollingTimer: Timer?
    private let urlSession = URLSession.shared

    private init() {}

    func startPolling() {
        guard pollingTimer == nil else { return }
        Task { isOnline = await checkHealth() }
        pollingTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.isOnline = await self?.checkHealth() ?? false
            }
        }
    }

    func query(_ prompt: String) async throws {
        isProcessing = true
        defer { isProcessing = false }
        guard let url = URL(string: "https://api.grizzlymedicine.icu/ha/webhook") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["query": prompt])
        let (data, _) = try await urlSession.data(for: req)
        if let json = try? JSONDecoder().decode([String: String].self, from: data),
           let resp = json["response"] ?? json["message"] {
            lastResponse = resp
            WKInterfaceDevice.current().play(.notification)
        }
    }

    func sendQuickAction(_ action: QuickAction) async throws {
        switch action {
        case .homeScene:
            try await query("Activate home scene")
        case .toggleLights:
            try await query("Toggle workshop lights")
        case .systemStatus:
            isProcessing = true
            defer { isProcessing = false }
            isOnline = await checkHealth()
            lastResponse = isOnline ? "All systems nominal." : "H.U.G.H. offline."
            WKInterfaceDevice.current().play(isOnline ? .success : .failure)
        }
    }

    private func checkHealth() async -> Bool {
        guard let url = URL(string: "https://api.grizzlymedicine.icu/health") else { return false }
        guard let (data, _) = try? await urlSession.data(from: url),
              let json = try? JSONDecoder().decode([String: String].self, from: data) else { return false }
        return json["status"] == "ok"
    }
}
