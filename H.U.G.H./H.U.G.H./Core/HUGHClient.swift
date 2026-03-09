// HUGHClient.swift — Sovereign service layer
// All platforms import this single file for H.U.G.H. connectivity.
// Provides unified access to: H.U.G.H. API, Home Assistant, Convex, and LFM inference.
//
// MARK: - Upgrade to ConvexMobile SDK: https://github.com/get-convex/convex-swift (0.4.0+)
// Currently uses raw URLSession (mirrors WorkshopConvexService.swift approach).

import Foundation
import Combine

// MARK: - H.U.G.H. API model types

struct HAEvent: Codable, Identifiable, Sendable {
    let id: String
    let entityId: String
    let state: String
    let description: String
    let timestamp: Double
}

struct HAState: Codable, Identifiable, Sendable {
    let entity_id: String
    let state: String
    let attributes: [String: AnyCodable]
    let last_changed: String
    var id: String { entity_id }
}

// Note: WorkshopEntity is defined in WorkshopConvexService.swift (same target).
// HUGHClient references it directly; do not redeclare here.

// MARK: - LLM message types (OpenAI-compatible)

private struct LFMMessage: Codable {
    let role: String
    let content: String
}

private struct LFMRequest: Codable {
    let model: String
    let messages: [LFMMessage]
    let temperature: Double
    let max_tokens: Int
}

private struct LFMResponse: Codable {
    struct Choice: Codable {
        struct Message: Codable { let content: String }
        let message: Message
    }
    let choices: [Choice]
}

// MARK: - H.U.G.H. webhook types

private struct HUGHQueryRequest: Codable {
    let query: String
    let context: String?
}

private struct HUGHQueryResponse: Codable {
    let response: String?
    let message: String?
    var text: String { response ?? message ?? "" }
}

private struct HUGHHealthResponse: Codable {
    let status: String
}

// MARK: - HUGHClient

@MainActor
final class HUGHClient: ObservableObject {
    static let shared = HUGHClient()

    // MARK: Connection state
    @Published var isOnline: Bool = false
    @Published var haConnected: Bool = false
    @Published var convexConnected: Bool = false
    @Published var processingQuery: Bool = false

    // MARK: Live state
    @Published var recentHAEvents: [HAEvent] = []
    @Published var workshopEntities: [WorkshopEntity] = []
    @Published var lastHughResponse: String = ""
    @Published var haStates: [HAState] = []

    private var healthTimer: Timer?
    private let urlSession: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        urlSession = URLSession(configuration: config)
    }

    // MARK: - H.U.G.H. API

    /// Sends a natural language query to H.U.G.H. and returns the response text.
    func query(_ prompt: String, context: String? = nil) async throws -> String {
        guard let url = URL(string: "https://api.grizzlymedicine.icu/ha/webhook") else {
            throw HUGHError.invalidURL
        }
        processingQuery = true
        defer { processingQuery = false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = HUGHQueryRequest(query: prompt, context: context)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await urlSession.data(for: request)
        try validateHTTP(response)

        let decoded = try JSONDecoder().decode(HUGHQueryResponse.self, from: data)
        lastHughResponse = decoded.text
        return decoded.text
    }

    /// Returns true when H.U.G.H. API responds with {"status":"ok"}.
    @discardableResult
    func health() async -> Bool {
        guard let url = URL(string: "https://api.grizzlymedicine.icu/health") else { return false }
        do {
            let (data, _) = try await urlSession.data(from: url)
            let decoded = try JSONDecoder().decode(HUGHHealthResponse.self, from: data)
            return decoded.status == "ok"
        } catch {
            return false
        }
    }

    // MARK: - Home Assistant

    /// Fetches all HA entity states.
    @discardableResult
    func haGetStates() async throws -> [HAState] {
        let url = try haURL("api/states")
        let request = haRequest(url: url, method: "GET")
        let (data, response) = try await urlSession.data(for: request)
        try validateHTTP(response)
        let states = try JSONDecoder().decode([HAState].self, from: data)
        haStates = states
        haConnected = true
        return states
    }

    /// Calls a HA service (e.g. domain: "light", service: "turn_on").
    func haCallService(
        domain: String,
        service: String,
        entityID: String,
        data: [String: Any]? = nil
    ) async throws {
        let url = try haURL("api/services/\(domain)/\(service)")
        var request = haRequest(url: url, method: "POST")
        var body: [String: Any] = ["entity_id": entityID]
        data?.forEach { body[$0.key] = $0.value }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await urlSession.data(for: request)
        try validateHTTP(response)
    }

    /// Convenience toggle for any toggleable entity.
    func haToggle(_ entityID: String) async throws {
        let domain = String(entityID.split(separator: ".").first ?? "homeassistant")
        try await haCallService(domain: domain, service: "toggle", entityID: entityID)
    }

    // MARK: - Convex
    // MARK: - Upgrade to ConvexMobile SDK when adding real-time subscriptions

    private struct ConvexBody: Encodable {
        let path: String
        let args: [String: AnyCodable]
    }
    private struct ConvexResult<T: Decodable>: Decodable {
        let value: T
    }

    /// Executes a Convex query function and decodes the result.
    func convexQuery<T: Decodable>(_ function: String, args: [String: Any] = [:]) async throws -> T {
        let url = try convexEndpoint("query")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let codableArgs = args.mapValues { AnyCodable($0) }
        request.httpBody = try JSONEncoder().encode(ConvexBody(path: function, args: codableArgs))
        let (data, response) = try await urlSession.data(for: request)
        try validateHTTP(response)
        convexConnected = true
        let wrapper = try JSONDecoder().decode(ConvexResult<T>.self, from: data)
        return wrapper.value
    }

    /// Executes a Convex mutation function.
    func convexMutation(_ function: String, args: [String: Any] = [:]) async throws {
        let url = try convexEndpoint("mutation")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let codableArgs = args.mapValues { AnyCodable($0) }
        request.httpBody = try JSONEncoder().encode(ConvexBody(path: function, args: codableArgs))
        let (_, response) = try await urlSession.data(for: request)
        try validateHTTP(response)
    }

    // MARK: - LFM Inference (direct, OpenAI-compatible)

    /// Sends a prompt to the LFM inference engine.
    /// Uses proxied endpoint via H.U.G.H. API (nginx); falls back to direct if needed.
    func lfmComplete(
        _ prompt: String,
        systemPrompt: String? = nil,
        model: String = "local",
        maxTokens: Int = 1024
    ) async throws -> String {
        guard let url = URL(string: "https://api.grizzlymedicine.icu/v1/chat/completions") else {
            throw HUGHError.invalidURL
        }
        var messages: [LFMMessage] = []
        if let sys = systemPrompt {
            messages.append(LFMMessage(role: "system", content: sys))
        }
        messages.append(LFMMessage(role: "user", content: prompt))

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = LFMRequest(model: model, messages: messages, temperature: 0.7, max_tokens: maxTokens)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await urlSession.data(for: request)
        try validateHTTP(response)
        let decoded = try JSONDecoder().decode(LFMResponse.self, from: data)
        return decoded.choices.first?.message.content ?? ""
    }

    /// Direct LFM call bypassing the proxy (use when proxy unavailable).
    func lfmDirectComplete(
        _ prompt: String,
        systemPrompt: String? = nil,
        model: String = "local",
        maxTokens: Int = 1024
    ) async throws -> String {
        guard let url = URL(string: "http://187.124.28.147:8080/v1/chat/completions") else {
            throw HUGHError.invalidURL
        }
        var messages: [LFMMessage] = []
        if let sys = systemPrompt { messages.append(LFMMessage(role: "system", content: sys)) }
        messages.append(LFMMessage(role: "user", content: prompt))

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = LFMRequest(model: model, messages: messages, temperature: 0.7, max_tokens: maxTokens)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await urlSession.data(for: request)
        try validateHTTP(response)
        let decoded = try JSONDecoder().decode(LFMResponse.self, from: data)
        return decoded.choices.first?.message.content ?? ""
    }

    // MARK: - Health polling

    func startHealthPolling() {
        guard healthTimer == nil else { return }
        Task { @MainActor in
            isOnline = await health()
            if isOnline { try? await haGetStates() }
        }
        healthTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.isOnline = await self.health()
                if self.isOnline {
                    try? await self.haGetStates()
                } else {
                    self.haConnected = false
                }
            }
        }
    }

    func stopHealthPolling() {
        healthTimer?.invalidate()
        healthTimer = nil
    }

    // MARK: - Private helpers

    private func haURL(_ path: String) throws -> URL {
        guard let url = URL(string: "http://192.168.7.194:8123/\(path)") else {
            throw HUGHError.invalidURL
        }
        return url
    }

    private func haRequest(url: URL, method: String) -> URLRequest {
        var r = URLRequest(url: url)
        r.httpMethod = method
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // NOTE: Move haToken to Keychain before App Store submission
        r.setValue(
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3MGM1ZjA4YWRiZTg0ZTM2YTI0YmY5M2I4ZDNkODdlNyIsImlhdCI6MTc3MzA4OTY3NSwiZXhwIjoyMDg4NDQ5Njc1fQ.JnitS57smDEOUSCrrlJij5SpWz24zIa34Ur7IuI-vPQ",
            forHTTPHeaderField: "Authorization"
        )
        return r
    }

    private func convexEndpoint(_ endpoint: String) throws -> URL {
        guard let url = URL(string: "https://sincere-albatross-464.convex.cloud/api/\(endpoint)") else {
            throw HUGHError.invalidURL
        }
        return url
    }

    private func validateHTTP(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode) else {
            throw HUGHError.badResponse((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
    }
}

// MARK: - Error

enum HUGHError: LocalizedError {
    case invalidURL
    case badResponse(Int)
    case decodingFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:           return "H.U.G.H.: Invalid URL"
        case .badResponse(let c):   return "H.U.G.H.: HTTP \(c)"
        case .decodingFailed(let m): return "H.U.G.H.: Decode failed — \(m)"
        }
    }
}
