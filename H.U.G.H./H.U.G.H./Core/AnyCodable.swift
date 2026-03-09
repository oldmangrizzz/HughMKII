// AnyCodable.swift — H.U.G.H. Core
// Type-erased Codable wrapper for heterogeneous JSON values (HA attributes, Convex args).
// Used by HUGHClient, WorkshopConvexService (which has its own private copy), and platform targets.

import Foundation

public struct AnyCodable: Codable, @unchecked Sendable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(Bool.self)              { value = v; return }
        if let v = try? c.decode(Int.self)               { value = v; return }
        if let v = try? c.decode(Double.self)            { value = v; return }
        if let v = try? c.decode(String.self)            { value = v; return }
        if let v = try? c.decode([String: AnyCodable].self) { value = v; return }
        if let v = try? c.decode([AnyCodable].self)      { value = v; return }
        if c.decodeNil()                                 { value = Optional<Any>.none as Any; return }
        throw DecodingError.dataCorruptedError(
            in: c, debugDescription: "AnyCodable: unsupported type"
        )
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case let v as Bool:               try c.encode(v)
        case let v as Int:                try c.encode(v)
        case let v as Double:             try c.encode(v)
        case let v as Float:              try c.encode(Double(v))
        case let v as String:             try c.encode(v)
        case let v as [String: AnyCodable]: try c.encode(v)
        case let v as [AnyCodable]:       try c.encode(v)
        default:                          try c.encodeNil()
        }
    }
}

// Convenience subscript for dictionary payloads
extension Dictionary where Key == String, Value == AnyCodable {
    subscript(string key: String) -> String? {
        (self[key]?.value as? String)
    }
    subscript(bool key: String) -> Bool? {
        (self[key]?.value as? Bool)
    }
    subscript(double key: String) -> Double? {
        (self[key]?.value as? Double)
    }
}
