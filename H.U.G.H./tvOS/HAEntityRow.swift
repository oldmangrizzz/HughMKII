// HAEntityRow.swift — tvOS (also used in other targets)
// Renders a single Home Assistant entity state as a compact status badge.

import SwiftUI

struct HAEntityRow: View {
    let state: HAState
    var expanded: Bool = false

    private var domain: String {
        String(state.entity_id.split(separator: ".").first ?? "unknown")
    }

    private var icon: String {
        switch domain {
        case "light":        return "lightbulb.fill"
        case "switch":       return "switch.2"
        case "climate":      return "thermometer.medium"
        case "sensor":       return "sensor.fill"
        case "binary_sensor": return "dot.radiowaves.left.and.right"
        case "media_player": return "tv.fill"
        case "lock":         return "lock.fill"
        case "cover":        return "blinds.horizontal.closed"
        case "camera":       return "camera.fill"
        case "person":       return "person.fill"
        default:             return "cube.fill"
        }
    }

    private var stateColor: Color {
        switch state.state.lowercased() {
        case "on", "home", "open", "unlocked", "playing": return .green
        case "off", "away", "closed", "locked", "paused": return Color(red: 0.27, green: 0.27, blue: 0.4)
        case "unavailable", "unknown":                     return .red.opacity(0.7)
        default:                                           return .white.opacity(0.6)
        }
    }

    private var friendlyName: String {
        if let name = state.attributes["friendly_name"]?.value as? String { return name }
        return state.entity_id.split(separator: ".").last.map(String.init) ?? state.entity_id
    }

    var body: some View {
        if expanded {
            expandedRow
        } else {
            compactRow
        }
    }

    private var compactRow: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(stateColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(friendlyName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1)
                Text(state.state)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(stateColor)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }

    private var expandedRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(stateColor)
                Spacer()
                Circle()
                    .frame(width: 8, height: 8)
                    .foregroundStyle(stateColor)
            }
            Text(friendlyName)
                .font(.headline)
                .foregroundStyle(.white)
                .lineLimit(2)
            Text(state.state.uppercased())
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(stateColor)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}
