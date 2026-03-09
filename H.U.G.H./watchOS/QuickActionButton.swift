// QuickActionButton.swift — watchOS
// Compact, focusable action button for the watch UI quick-action row.

import SwiftUI

struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    @State private var pressed = false

    var body: some View {
        Button(action: {
            pressed = true
            WKInterfaceDevice.current().play(.click)
            action()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { pressed = false }
        }) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(color)
                Text(label)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                pressed
                    ? color.opacity(0.25)
                    : Color.white.opacity(0.07),
                in: RoundedRectangle(cornerRadius: 10)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.15), value: pressed)
    }
}

import WatchKit

#Preview {
    HStack {
        QuickActionButton(icon: "house.fill", label: "Home", color: .blue) {}
        QuickActionButton(icon: "lightbulb.fill", label: "Lights", color: .yellow) {}
        QuickActionButton(icon: "waveform.path.ecg", label: "Status", color: .green) {}
    }
    .padding()
    .background(Color.black)
}
