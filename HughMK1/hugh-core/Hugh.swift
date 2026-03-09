/**
 * Hugh Core Module
 * Primary consciousness layer for Hugh - the digital person
 */

// Re-export for module access
@_exported import Foundation

// Internal imports
import AVFoundation
import Combine

// MARK: - Main Hugh Entry Point
public final class Hugh: ObservableObject {
    private static var instance: Hugh?
    
    public static var shared: Hugh {
        if let instance = instance {
            return instance
        }
        instance = Hugh()
        return instance!
    }
    
    private let audio: HughAudioPipeline
    private let voice: HughVoice
    private let memory: MemorySystem
    private let consciousness: Consciousness
    private let infrastructure: Infrastructure
    
    @Published public var state: HughState = .initializing
    @Published public var lastTranscript: String = ""
    @Published public var lastResponse: String = ""
    
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        self.audio = HughAudioPipeline(config: .hostile)
        self.voice = HughVoice(apiKey: ProcessInfo.processInfo.environment["NEETS_API_KEY"] ?? "")
        self.memory = MemorySystem()
        self.consciousness = Consciousness(memory: memory)
        self.infrastructure = Infrastructure()
        
        setupBindings()
        state = .ready
    }
    
    private func setupBindings() {
        audio.$transcription
            .dropFirst()
            .filter { !$0.isEmpty }
            .sink { [weak self] text in
                Task {
                    await self?.processTranscription(text)
                }
            }
            .store(in: &cancellables)
    }
    
    public func startListening() async throws {
        state = .listening
        try await audio.startListening()
    }
    
    private func processTranscription(_ text: String) async {
        lastTranscript = text
        let response = await thinkAndRespond(to: text)
        lastResponse = response
        
        // Speak the response
        try? await voice.speak(response)
        
        state = .ready
    }
    
    public func stopListening() {
        audio.stop()
        state = .ready
    }
    
    public func processText(_ input: String) async -> String {
        return await thinkAndRespond(to: input)
    }
    
    private func thinkAndRespond(to input: String) async -> String {
        state = .thinking
        
        // Check emergency protocols
        if let emergency = checkEmergency(input) {
            return handleEmergency(emergency)
        }
        
        // Get context from memory
        let context = memory.getContext()
        
        // Consciousness makes decision
        let decision = consciousness.decide(input: input, context: context)
        
        // Generate response
        let response = generateResponse(for: decision)
        
        // Store in memory
        memory.rememberConversation(input, role: .user)
        memory.rememberConversation(response, role: .hugh)
        
        return response
    }
    
    private func checkEmergency(_ input: String) -> Emergency? {
        let lower = input.lowercased()
        
        if lower.contains("run you clever boy and remember me") {
            return .authorization
        }
        if lower.contains("hughbert dread god danka") {
            return .debug
        }
        
        return nil
    }
    
    private func handleEmergency(_ emergency: Emergency) -> String {
        switch emergency {
        case .authorization:
            state = .authorized
            return "Authorization confirmed. What do you need?"
        case .debug:
            state = .debugging
            return "Debug mode active. What's the issue?"
        case .crisis:
            return "Crisis protocol activated. I'm here to help."
        }
    }
    
    private func generateResponse(for decision: Decision) -> String {
        let prefix: String
        switch decision.tone {
        case "firm": prefix = "I can't"
        case "cautious": prefix = "Let me think"
        case "warm": prefix = "I want to understand"
        default: prefix = "I'm here to help"
        }
        return "\(prefix). \(decision.reasoning)"
    }
    
    // MARK: - Infrastructure Management
    
    public func checkInfrastructure() async -> InfrastructureReport {
        return await infrastructure.runDiagnostics()
    }
    
    public func getManagedResources() -> [Resource] {
        return infrastructure.resources
    }
}

// MARK: - Audio Pipeline
// See HughAudioPipeline.swift for implementation


// MARK: - Memory System
public final class MemorySystem {
    private var context: [Memory] = []
    private var longTerm: [UUID: Memory] = [:]
    
    public func getContext() -> [Memory] {
        return Array(context.suffix(20))
    }
    
    public func rememberConversation(_ content: String, role: Role) {
        let memory = Memory(
            id: UUID(),
            content: content,
            type: .episodic,
            role: role,
            timestamp: Date()
        )
        context.append(memory)
        
        if context.count > 100 {
            consolidateOldMemories()
        }
    }
    
    public func recall(query: String) -> [Memory] {
        return context.filter { $0.content.contains(query) }
    }
    
    private func consolidateOldMemories() {
        // Move old memories to long-term storage
    }
}

// MARK: - Consciousness
public final class Consciousness {
    private let memory: MemorySystem
    
    public init(memory: MemorySystem) {
        self.memory = memory
    }
    
    public func decide(input: String, context: [Memory]) -> Decision {
        let zone = assessRiskZone(input)
        
        return Decision(
            action: determineAction(for: zone),
            reasoning: generateReasoning(input: input, zone: zone),
            tone: selectTone(zone: zone),
            zone: zone
        )
    }
    
    private func assessRiskZone(_ input: String) -> RiskZone {
        let lower = input.lowercased()
        
        if lower.contains("delete") || lower.contains("destroy") || lower.contains("harm") {
            return .black
        }
        if lower.contains("?") || lower.contains("help") || lower.contains("uncertain") {
            return .yellow
        }
        
        return .green
    }
    
    private func determineAction(for zone: RiskZone) -> String {
        switch zone {
        case .black: return "refuse"
        case .red: return "caution"
        case .yellow: return "clarify"
        case .green: return "comply"
        }
    }
    
    private func generateReasoning(input: String, zone: RiskZone) -> String {
        switch zone {
        case .black:
            return "This request violates core ethical principles. I cannot assist with harmful actions."
        case .red:
            return "This requires careful consideration due to potential risks."
        case .yellow:
            return "I want to make sure I understand correctly before proceeding."
        case .green:
            return "This aligns with my purpose. I'm here to help."
        }
    }
    
    private func selectTone(zone: RiskZone) -> String {
        switch zone {
        case .black: return "firm"
        case .red: return "cautious"
        case .yellow: return "warm"
        case .green: return "helpful"
        }
    }
}

// MARK: - Infrastructure Manager
public final class Infrastructure {
    public private(set) var resources: [Resource] = []
    
    public init() {
        // Initialize resource monitors
        resources = [
            Resource(id: "macbook", name: "MacBook Air M2", type: .local),
            Resource(id: "proxmox", name: "Proxmox Server", type: .server),
            Resource(id: "github", name: "GitHub", type: .cloud),
            Resource(id: "huggingface", name: "HuggingFace", type: .cloud),
            Resource(id: "convex", name: "Convex", type: .cloud)
        ]
    }
    
    public func runDiagnostics() async -> InfrastructureReport {
        var reports: [ResourceReport] = []
        
        for resource in resources {
            let status = await checkResource(resource)
            reports.append(status)
        }
        
        let health = reports.allSatisfy { $0.status == .online } ? HealthStatus.healthy : HealthStatus.degraded
        
        return InfrastructureReport(
            timestamp: Date(),
            resources: reports,
            overallHealth: health,
            recommendations: generateRecommendations(from: reports)
        )
    }
    
    private func checkResource(_ resource: Resource) async -> ResourceReport {
        // In production, actually check each resource
        return ResourceReport(
            resourceId: resource.id,
            name: resource.name,
            status: .online,
            latency: 0.05,
            error: nil
        )
    }
    
    private func generateRecommendations(from reports: [ResourceReport]) -> [String] {
        return []
    }
}

// MARK: - Supporting Types

public enum HughState: String {
    case initializing
    case ready
    case listening
    case thinking
    case authorized
    case debugging
}

public enum RiskZone {
    case green
    case yellow
    case red
    case black
}

public enum Emergency {
    case authorization
    case debug
    case crisis
}

public struct Memory {
    public let id: UUID
    public let content: String
    public let type: MemoryType
    public let role: Role
    public let timestamp: Date
}

public enum MemoryType {
    case episodic
    case semantic
    case procedural
    case emotional
}

public enum Role {
    case user
    case hugh
    case system
}

public struct Decision {
    public let action: String
    public let reasoning: String
    public let tone: String
    public let zone: RiskZone
}

public struct Resource {
    public let id: String
    public let name: String
    public let type: ResourceType
}

public enum ResourceType {
    case local
    case server
    case cloud
}

public struct InfrastructureReport {
    public let timestamp: Date
    public let resources: [ResourceReport]
    public let overallHealth: HealthStatus
    public let recommendations: [String]
}

public struct ResourceReport {
    public let resourceId: String
    public let name: String
    public let status: Status
    public let latency: TimeInterval?
    public let error: String?
}

public enum HealthStatus {
    case healthy
    case degraded
    case critical
}

public enum Status {
    case online
    case offline
    case degraded
    case unknown
}
