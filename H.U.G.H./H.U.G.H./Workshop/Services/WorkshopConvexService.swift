//
//  WorkshopConvexService.swift
//  H.U.G.H. – Workshop Layer
//
//  Syncs Workshop 3D scene state with the Convex backend via its HTTP API.
//  No official Swift SDK exists; all communication uses URLSession async/await
//  against the documented Convex REST endpoints:
//    POST <base>/api/query    – read-only queries
//    POST <base>/api/mutation – state-changing mutations
//

import Foundation
import Combine

#if canImport(simd)
import simd
#endif

// MARK: - Data Models

/// A 3D object that lives in the Workshop scene, mirroring the `workshop_entities` Convex table.
struct WorkshopEntity: Codable, Identifiable {
    /// Convex document `_id` (used as SwiftUI list identity).
    let id: String
    /// Application-level stable identifier (e.g. UUID string).
    let entityId: String
    /// Geometry primitive category: `"table"`, `"chair"`, `"screen"`, `"light"`, or `"custom"`.
    let type: String
    /// Human-readable display name shown in the Workshop HUD.
    let label: String
    let positionX: Double
    let positionY: Double
    let positionZ: Double
    let rotationX: Double
    let rotationY: Double
    let rotationZ: Double
    let scaleX: Double
    let scaleY: Double
    let scaleZ: Double
    /// Hex colour string, e.g. `"#FF8C00"`.
    let color: String
    let visible: Bool
}

/// Global ambient state for the current Workshop session, mirroring `workshop_environment`.
struct WorkshopEnvironment: Codable {
    let sessionId: String
    /// Hex colour string driving RealityKit ambient light.
    let ambientColor: String
    let ambientIntensity: Double
    /// `"nominal"` | `"warning"` | `"critical"`.
    let healthStatus: String
}

// MARK: - Convex HTTP helpers

private struct ConvexRequest: Encodable {
    let path: String
    let args: [String: AnyCodable]
}

private struct ConvexQueryResponse<T: Decodable>: Decodable {
    let value: T
}

/// Type-erased Codable wrapper so we can pass heterogeneous dicts to Convex.
private struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(Bool.self)   { value = v; return }
        if let v = try? c.decode(Int.self)    { value = v; return }
        if let v = try? c.decode(Double.self) { value = v; return }
        if let v = try? c.decode(String.self) { value = v; return }
        value = NSNull()
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case let v as Bool:   try c.encode(v)
        case let v as Int:    try c.encode(v)
        case let v as Double: try c.encode(v)
        case let v as Float:  try c.encode(Double(v))
        case let v as String: try c.encode(v)
        default:              try c.encodeNil()
        }
    }
}

// MARK: - Service

/// Polls the Convex backend every two seconds and publishes Workshop scene state.
///
/// Initialise with a Convex deployment URL. The URL is resolved in priority order:
/// 1. `CONVEX_URL` environment variable
/// 2. `ConvexURL` key in `Info.plist`
/// 3. The `convexURL` parameter passed to `init` (fallback)
@MainActor
final class WorkshopConvexService: ObservableObject {

    // MARK: Published state

    /// Currently visible Workshop entities.
    @Published var entities: [WorkshopEntity] = []
    /// Current ambient environment state.
    @Published var environment: WorkshopEnvironment?
    /// Whether the last poll succeeded.
    @Published var isConnected: Bool = false

    // MARK: Private

    private let convexBaseURL: String
    private var pollingTimer: Timer?
    private let session: URLSession

    // MARK: Init

    /// - Parameter convexURL: Fallback URL used when neither the environment variable
    ///   nor `Info.plist` supplies one.
    init(convexURL: String = "https://your-deployment.convex.cloud") {
        // Resolution order: env var → Info.plist → parameter
        if let envURL = ProcessInfo.processInfo.environment["CONVEX_URL"], !envURL.isEmpty {
            self.convexBaseURL = envURL
        } else if let plistURL = Bundle.main.object(forInfoDictionaryKey: "ConvexURL") as? String,
                  !plistURL.isEmpty {
            self.convexBaseURL = plistURL
        } else {
            self.convexBaseURL = convexURL
        }

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        self.session = URLSession(configuration: config)
    }

    // MARK: - Sync lifecycle

    /// Begins polling Convex every 2 seconds.
    func startSync() {
        guard pollingTimer == nil else { return }
        // Immediate first fetch
        Task { await pollOnce() }

        pollingTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { await self.pollOnce() }
        }
    }

    /// Stops background polling.
    func stopSync() {
        pollingTimer?.invalidate()
        pollingTimer = nil
    }

    // MARK: - Public API

    /// Fetches all visible Workshop entities from Convex.
    @discardableResult
    func fetchEntities() async throws -> [WorkshopEntity] {
        let raw = try await convexQuery(
            path: "workshop:getWorkshopEntities",
            args: [:],
            responseType: [WorkshopEntity].self
        )
        entities = raw
        return raw
    }

    /// Fetches the ambient environment state for a given session.
    @discardableResult
    func fetchEnvironment(sessionId: String) async throws -> WorkshopEnvironment? {
        let result = try await convexQuery(
            path: "workshop:getEnvironmentState",
            args: ["sessionId": AnyCodable(sessionId)],
            responseType: WorkshopEnvironment?.self
        )
        environment = result
        return result
    }

    /// Spawns a new entity in the Workshop scene.
    ///
    /// - Parameters:
    ///   - type: One of `"table"`, `"chair"`, `"screen"`, `"light"`, `"custom"`.
    ///   - label: Display name for the entity.
    ///   - position: World-space position in metres.
    func spawnEntity(type: String, label: String, position: SIMD3<Float>) async throws {
        let entityId = UUID().uuidString
        let args: [String: AnyCodable] = [
            "entityId":  AnyCodable(entityId),
            "type":      AnyCodable(type),
            "label":     AnyCodable(label),
            "positionX": AnyCodable(Double(position.x)),
            "positionY": AnyCodable(Double(position.y)),
            "positionZ": AnyCodable(Double(position.z)),
            "rotationX": AnyCodable(0.0),
            "rotationY": AnyCodable(0.0),
            "rotationZ": AnyCodable(0.0),
            "scaleX":    AnyCodable(1.0),
            "scaleY":    AnyCodable(1.0),
            "scaleZ":    AnyCodable(1.0),
            "color":     AnyCodable("#4A90E2"),
            "visible":   AnyCodable(true),
        ]
        try await convexMutation(path: "workshop:upsertWorkshopEntity", args: args)
    }

    /// Removes an entity from the Workshop scene by its stable `entityId`.
    func deleteEntity(entityId: String) async throws {
        try await convexMutation(
            path: "workshop:deleteWorkshopEntity",
            args: ["entityId": AnyCodable(entityId)]
        )
    }

    /// Appends a Human-On-The-Loop audit entry.
    ///
    /// - Parameters:
    ///   - type: Action type, e.g. `"tool_call"`, `"decision"`.
    ///   - description: Human-readable description of what happened.
    ///   - riskZone: `"green"`, `"yellow"`, `"red"`, or `"black"`.
    func logAction(type: String, description: String, riskZone: String) async throws {
        let args: [String: AnyCodable] = [
            "agentId":           AnyCodable("visionOS-workshop"),
            "actionType":        AnyCodable(type),
            "actionDescription": AnyCodable(description),
            "riskZone":          AnyCodable(riskZone),
            "requiresReview":    AnyCodable(riskZone == "red" || riskZone == "black"),
            "operatorAcknowledged": AnyCodable(false),
        ]
        try await convexMutation(path: "workshop:logHOTLAction", args: args)
    }

    // MARK: - Private helpers

    private func pollOnce() async {
        do {
            try await fetchEntities()
            // Use a static session id for the visionOS client
            try await fetchEnvironment(sessionId: "visionos-session")
            isConnected = true
        } catch {
            isConnected = false
        }
    }

    /// Executes a Convex **query** (read-only).
    private func convexQuery<T: Decodable>(
        path: String,
        args: [String: AnyCodable],
        responseType: T.Type
    ) async throws -> T {
        let url = try convexURL(endpoint: "query")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ConvexRequest(path: path, args: args)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateHTTPResponse(response)

        // Convex wraps the result in { "value": <result> }
        let wrapper = try JSONDecoder().decode(ConvexQueryResponse<T>.self, from: data)
        return wrapper.value
    }

    /// Executes a Convex **mutation** (write).
    private func convexMutation(path: String, args: [String: AnyCodable]) async throws {
        let url = try convexURL(endpoint: "mutation")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ConvexRequest(path: path, args: args)
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await session.data(for: request)
        try validateHTTPResponse(response)
    }

    private func convexURL(endpoint: String) throws -> URL {
        guard let url = URL(string: "\(convexBaseURL)/api/\(endpoint)") else {
            throw URLError(.badURL)
        }
        return url
    }

    private func validateHTTPResponse(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}
