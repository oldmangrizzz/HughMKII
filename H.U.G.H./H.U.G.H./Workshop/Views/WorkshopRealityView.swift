//
//  WorkshopRealityView.swift
//  H.U.G.H. – Workshop Layer
//
//  Native visionOS spatial view for the H.U.G.H. Workshop environment.
//  Uses RealityKit's `RealityView` to render 3D entities whose state is
//  continuously synced from the Convex backend via `WorkshopConvexService`.
//

import SwiftUI

#if os(visionOS)
import RealityKit
import Combine

// MARK: - Constants

private enum Workshop {
    static let floorY: Float     = -0.8      // metres below eye level
    static let gridSize: Float   = 4.0
    static let gridTiles: Int    = 8
    static let entityBaseTag     = "workshop-entity-"
    static let hughPresenceTag   = "hugh-presence"
    static let floorTag          = "workshop-floor"
}

// MARK: - Main View

/// The primary visionOS Workshop view.
///
/// Renders the 3D Workshop scene in a `RealityView`, attaches a control-panel
/// ornament at the bottom of the window, and drives scene updates whenever
/// `WorkshopConvexService` publishes new entity/environment state.
struct WorkshopRealityView: View {

    @StateObject private var convexService  = WorkshopConvexService()
    @StateObject private var voiceController = WorkshopVoiceController()
    @State private var selectedEntity: WorkshopEntity?

    var body: some View {
        RealityView { content in
            setupWorkshopEnvironment(content: content)
        } update: { content in
            updateEntities(content: content)
        }
        // Tap any RealityKit entity to select it
        .gesture(
            TapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    selectedEntity = entityFor(value.entity, in: convexService.entities)
                }
        )
        // Bottom ornament: HUD control panel
        .ornament(attachmentAnchor: .scene(.bottom)) {
            WorkshopControlPanel(
                voiceController: voiceController,
                convexService: convexService,
                selectedEntity: $selectedEntity
            )
        }
        // Wire up voice commands → Convex mutations
        .onChange(of: voiceController.lastCommand) { _, command in
            guard let command else { return }
            handleVoiceCommand(command)
        }
        .onAppear  { convexService.startSync() }
        .onDisappear { convexService.stopSync() }
    }

    // MARK: - Scene construction

    /// Builds the static Workshop environment: grid floor + H.U.G.H. presence light.
    private func setupWorkshopEnvironment(content: RealityViewContent) {
        // ── Floor grid ──────────────────────────────────────────────────────
        let tileSize = Workshop.gridSize / Float(Workshop.gridTiles)
        for row in 0..<Workshop.gridTiles {
            for col in 0..<Workshop.gridTiles {
                let mesh = MeshResource.generatePlane(width: tileSize - 0.01,
                                                      depth: tileSize - 0.01)
                var mat  = SimpleMaterial()
                let isDark = (row + col) % 2 == 0
                mat.color = .init(tint: isDark ? .init(white: 0.05, alpha: 1)
                                              : .init(white: 0.08, alpha: 1))
                mat.roughness = .float(0.9)
                let tile  = ModelEntity(mesh: mesh, materials: [mat])
                let xOff  = (Float(col) - Float(Workshop.gridTiles) / 2 + 0.5) * tileSize
                let zOff  = (Float(row) - Float(Workshop.gridTiles) / 2 + 0.5) * tileSize
                tile.position = SIMD3(xOff, Workshop.floorY, zOff)
                tile.name     = "\(Workshop.floorTag)-\(row)-\(col)"
                content.add(tile)
            }
        }

        // ── H.U.G.H. presence: pulsing point light ───────────────────────
        let presenceAnchor = AnchorEntity(world: SIMD3(0, 0.5, -1.5))
        let light = PointLightComponent(
            color: .init(WorkshopAmbientSystem.particleColor(for: "nominal")),
            intensity: WorkshopAmbientSystem.lightIntensity(for: "nominal"),
            attenuationRadius: 3.0
        )
        let presenceEntity = Entity()
        presenceEntity.name = Workshop.hughPresenceTag
        presenceEntity.components.set(light)
        presenceAnchor.addChild(presenceEntity)
        content.add(presenceAnchor)
    }

    /// Reconciles the live `convexService.entities` list with RealityKit scene entities.
    private func updateEntities(content: RealityViewContent) {
        let liveIDs = Set(convexService.entities.map { "\(Workshop.entityBaseTag)\($0.entityId)" })

        // Remove stale entities
        for entity in content.entities where entity.name.hasPrefix(Workshop.entityBaseTag) {
            if !liveIDs.contains(entity.name) {
                content.remove(entity)
            }
        }

        // Add / update live entities
        for entity in convexService.entities where entity.visible {
            let tag = "\(Workshop.entityBaseTag)\(entity.entityId)"
            if content.entities.first(where: { $0.name == tag }) == nil {
                if let model = makeModelEntity(for: entity) {
                    model.name = tag
                    content.add(model)
                }
            }
        }

        // Update H.U.G.H. presence light from environment health
        if let status = convexService.environment?.healthStatus,
           let presence = content.entities.first(where: { $0.name == Workshop.hughPresenceTag }) {
            presence.components.set(PointLightComponent(
                color: .init(WorkshopAmbientSystem.particleColor(for: status)),
                intensity: WorkshopAmbientSystem.lightIntensity(for: status),
                attenuationRadius: 3.0
            ))
        }
    }

    // MARK: - Entity factory

    /// Maps a `WorkshopEntity` to a RealityKit `ModelEntity` using primitive meshes.
    ///
    /// Type → mesh mapping:
    /// - `table`  → flat box
    /// - `screen` → thin plane
    /// - `light`  → small sphere
    /// - `chair`  → medium box
    /// - `custom` → cube
    private func makeModelEntity(for data: WorkshopEntity) -> ModelEntity? {
        let mesh: MeshResource
        switch data.type {
        case "table":
            mesh = .generateBox(width: 1.2, height: 0.05, depth: 0.6)
        case "screen":
            mesh = .generatePlane(width: 1.6, depth: 0.9)
        case "light":
            mesh = .generateSphere(radius: 0.08)
        case "chair":
            mesh = .generateBox(width: 0.5, height: 0.45, depth: 0.5)
        default:
            mesh = .generateBox(size: 0.3)
        }

        var material = SimpleMaterial()
        if let uiColor = PlatformColor(hex: data.color) {
            material.color = .init(tint: uiColor)
        }
        material.roughness = .float(0.6)
        material.metallic  = .float(0.2)

        let entity = ModelEntity(mesh: mesh, materials: [material])
        entity.position = SIMD3(
            Float(data.positionX),
            Float(data.positionY),
            Float(data.positionZ)
        )
        entity.orientation = simd_quatf(
            angle: Float(data.rotationY),
            axis: SIMD3(0, 1, 0)
        )
        entity.scale = SIMD3(
            Float(data.scaleX),
            Float(data.scaleY),
            Float(data.scaleZ)
        )

        // Make the entity tappable
        entity.generateCollisionShapes(recursive: false)
        entity.components.set(InputTargetComponent())

        return entity
    }

    // MARK: - Entity lookup

    private func entityFor(_ rkEntity: Entity, in entities: [WorkshopEntity]) -> WorkshopEntity? {
        guard rkEntity.name.hasPrefix(Workshop.entityBaseTag) else { return nil }
        let entityId = String(rkEntity.name.dropFirst(Workshop.entityBaseTag.count))
        return entities.first { $0.entityId == entityId }
    }

    // MARK: - Voice command dispatch

    private func handleVoiceCommand(_ command: WorkshopVoiceCommand) {
        Task {
            switch command {
            case .spawn(let type, let label):
                try? await convexService.spawnEntity(
                    type: type,
                    label: label,
                    position: SIMD3(0, 0, -1.5)
                )
                try? await convexService.logAction(
                    type: "tool_call",
                    description: "Voice: spawn \(type) '\(label)'",
                    riskZone: "green"
                )
            case .delete(let label):
                if let match = convexService.entities.first(where: { $0.label.lowercased() == label }) {
                    try? await convexService.deleteEntity(entityId: match.entityId)
                }
            case .requestStatus:
                // Status is reflected live in the control panel; nothing to mutate.
                break
            case .changeColor, .unknown:
                break
            }
        }
    }
}

// MARK: - Control Panel Ornament

/// Glass-morphism HUD panel displayed as a bottom ornament in the Workshop window.
struct WorkshopControlPanel: View {

    @ObservedObject var voiceController: WorkshopVoiceController
    @ObservedObject var convexService:   WorkshopConvexService
    @Binding var selectedEntity: WorkshopEntity?

    var body: some View {
        HStack(spacing: 20) {

            // ── Microphone ─────────────────────────────────────────────────
            Button {
                if voiceController.isListening {
                    voiceController.stopListening()
                } else {
                    voiceController.startListening()
                }
            } label: {
                Image(systemName: voiceController.isListening
                      ? "mic.fill" : "mic.slash.fill")
                    .font(.title2)
                    .foregroundStyle(voiceController.isListening ? .red : .secondary)
                    .symbolEffect(.pulse, isActive: voiceController.isListening)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(voiceController.isListening ? "Stop listening" : "Start listening")

            // ── Transcription ───────────────────────────────────────────────
            VStack(alignment: .leading, spacing: 2) {
                Text(voiceController.transcription.isEmpty
                     ? "Say a command…"
                     : voiceController.transcription)
                    .font(.caption)
                    .foregroundStyle(voiceController.transcription.isEmpty ? .tertiary : .primary)
                    .lineLimit(2)
                    .frame(maxWidth: 260, alignment: .leading)

                if let cmd = voiceController.lastCommand {
                    Text(commandSummary(cmd))
                        .font(.caption2)
                        .foregroundStyle(.teal)
                }
            }

            Divider().frame(height: 36)

            // ── Entities count ──────────────────────────────────────────────
            VStack(spacing: 2) {
                Text("\(convexService.entities.filter(\.visible).count)")
                    .font(.title3.monospacedDigit())
                    .fontWeight(.semibold)
                Text("entities")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // ── H.U.G.H. / server health ────────────────────────────────────
            VStack(spacing: 2) {
                Circle()
                    .fill(healthColor(convexService.environment?.healthStatus))
                    .frame(width: 12, height: 12)
                    .overlay(
                        Circle()
                            .stroke(.white.opacity(0.3), lineWidth: 1)
                    )
                Text(convexService.environment?.healthStatus ?? "—")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // ── Connection status ────────────────────────────────────────────
            Image(systemName: convexService.isConnected
                  ? "network" : "network.slash")
                .foregroundStyle(convexService.isConnected ? .green : .red)
                .font(.body)
                .accessibilityLabel(convexService.isConnected ? "Connected" : "Disconnected")
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(.white.opacity(0.12), lineWidth: 1)
        )
    }

    // MARK: Private helpers

    private func healthColor(_ status: String?) -> Color {
        switch status {
        case "critical": return .red
        case "warning":  return .orange
        default:         return .green
        }
    }

    private func commandSummary(_ command: WorkshopVoiceCommand) -> String {
        switch command {
        case .spawn(let type, let label):       return "↑ spawn \(type) "\(label)""
        case .delete(let label):               return "✕ delete "\(label)""
        case .changeColor(let e, let c):       return "⬛ \(e) → \(c)"
        case .requestStatus:                   return "ℹ status requested"
        case .unknown(let raw):                return "? \(raw)"
        }
    }
}

// MARK: - Preview

#Preview(windowStyle: .volumetric) {
    WorkshopRealityView()
}

#else // not visionOS

/// Placeholder shown when building for non-visionOS targets (iOS, macOS).
struct WorkshopRealityView: View {
    var body: some View {
        ContentUnavailableView(
            "Workshop requires visionOS",
            systemImage: "visionpro",
            description: Text("The spatial Workshop environment runs only on Apple Vision Pro.")
        )
    }
}

/// Stub so ContentView can reference this type on all platforms.
struct WorkshopControlPanel: View {
    var body: some View { EmptyView() }
}

#endif // os(visionOS)
