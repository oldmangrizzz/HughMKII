//
//  WorkshopAmbientSystem.swift
//  H.U.G.H. – Workshop Layer
//
//  Maps Convex `healthStatus` and `server_health` values to RealityKit
//  lighting parameters, keeping the Workshop's visual atmosphere in sync
//  with H.U.G.H.'s infrastructure health.
//

import Foundation

#if os(visionOS) || os(iOS)
import UIKit
/// Platform colour alias so the rest of the file stays platform-agnostic.
typealias PlatformColor = UIColor
#elseif os(macOS)
import AppKit
typealias PlatformColor = NSColor
#endif

// MARK: - Colour palette

private extension PlatformColor {
    /// Initialises from a CSS hex string such as `"#FF8C00"` or `"FF8C00"`.
    convenience init?(hex: String) {
        let raw = hex.trimmingCharacters(in: .init(charactersIn: "#"))
        guard raw.count == 6,
              let value = UInt64(raw, radix: 16) else { return nil }
        let r = CGFloat((value >> 16) & 0xFF) / 255
        let g = CGFloat((value >>  8) & 0xFF) / 255
        let b = CGFloat((value >>  0) & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}

// MARK: - WorkshopAmbientSystem

/// Pure-static helpers that translate H.U.G.H.'s health vocabulary into
/// RealityKit-ready lighting values.
///
/// Health status vocabulary (mirrors `workshop_environment.healthStatus`):
/// - `"nominal"`  – everything green, deep Workshop blue palette
/// - `"warning"`  – amber alert, something needs attention
/// - `"critical"` – crimson danger, operator action required
struct WorkshopAmbientSystem {

    // MARK: Ambient colour

    /// Returns the scene ambient light colour for a given health status.
    ///
    /// - `"critical"` → Crimson `#DC143C`
    /// - `"warning"`  → Amber   `#FF8C00`
    /// - anything else → Deep Workshop blue `#0A1628`
    static func ambientColor(for status: String) -> PlatformColor {
        switch status {
        case "critical": return PlatformColor(hex: "#DC143C") ?? .red
        case "warning":  return PlatformColor(hex: "#FF8C00") ?? .orange
        default:         return PlatformColor(hex: "#0A1628") ?? .black
        }
    }

    // MARK: Particle colour

    /// Returns the colour tint to apply to the H.U.G.H. presence particle system.
    ///
    /// Particles pulse more intensely as status degrades:
    /// - `"critical"` → Bright red
    /// - `"warning"`  → Deep amber
    /// - `"nominal"`  → Cyan-blue digital glow `#00BFFF`
    static func particleColor(for status: String) -> PlatformColor {
        switch status {
        case "critical": return PlatformColor(hex: "#FF2020") ?? .red
        case "warning":  return PlatformColor(hex: "#FFA500") ?? .orange
        default:         return PlatformColor(hex: "#00BFFF") ?? .cyan
        }
    }

    // MARK: Light intensity

    /// Returns the point-light intensity (in lux) for a given health status.
    ///
    /// Higher severity → brighter alert lighting to draw operator attention.
    /// - `"critical"` → `1200` lux
    /// - `"warning"`  → `600`  lux
    /// - `"nominal"`  → `200`  lux
    static func lightIntensity(for status: String) -> Float {
        switch status {
        case "critical": return 1200
        case "warning":  return 600
        default:         return 200
        }
    }

    // MARK: Pulse speed

    /// Returns the oscillation frequency (Hz) used to animate ambient pulsing.
    ///
    /// Faster pulse = higher urgency.
    /// - `"critical"` → `3.0` Hz
    /// - `"warning"`  → `1.5` Hz
    /// - `"nominal"`  → `0.5` Hz
    static func pulseFrequency(for status: String) -> Float {
        switch status {
        case "critical": return 3.0
        case "warning":  return 1.5
        default:         return 0.5
        }
    }

    // MARK: Hex from PlatformColor

    /// Converts a `PlatformColor` back to a CSS hex string (e.g. `"#FF8C00"`).
    /// Useful when forwarding colour overrides back to Convex.
    static func hexString(from color: PlatformColor) -> String {
        var r: CGFloat = 0; var g: CGFloat = 0; var b: CGFloat = 0; var a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X",
                      Int((r * 255).rounded()),
                      Int((g * 255).rounded()),
                      Int((b * 255).rounded()))
    }
}
