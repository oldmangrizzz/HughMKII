/**
 * Hugh Hybrid Memory System
 * GraphMERT + MemGPT architecture for persistent, autonomous memory management
 */

import Foundation
import AVFoundation

// MARK: - Memory Types
enum MemoryType {
    case episodic      // Conversations, experiences, events
    case semantic      // Facts, knowledge, learned patterns
    case procedural    // Skills, workflows, how-to
    case working       // Current context, active tasks
    case emotional     // Affective state, sentiment, user wellbeing
}

// MARK: - Importance Scoring (MemGPT-style)
struct ImportanceScore {
    let baseScore: Double        // 0.0 - 1.0 based on content
    let recencyWeight: Double    // Recent = higher
    let emotionalWeight: Double  // Emotional content = higher
    let userAttentionWeight: Double // Direct user interaction = higher
    let systemRelevanceWeight: Double // Relevant to system goals = higher
    
    var totalScore: Double {
        let weights = [recencyWeight, emotionalWeight, userAttentionWeight, systemRelevanceWeight]
        let avgWeight = weights.reduce(0, +) / Double(weights.count)
        return baseScore * (0.5 + (avgWeight * 0.5))
    }
}

// MARK: - Memory Node (GraphMERT + MemGPT hybrid)
final class MemoryNode: Identifiable, Observable {
    let id: UUID
    let type: MemoryType
    var content: String
    var embedding: [Float]?
    let createdAt: Date
    var lastAccessed: Date
    var accessCount: Int
    var importance: ImportanceScore
    var metadata: MemoryMetadata
    var relationships: [MemoryRelationship]
    var consolidationState: ConsolidationState
    
    enum ConsolidationState {
        case shortTerm
        case consolidating
        case longTerm
        case archived
    }
    
    init(type: MemoryType, content: String, metadata: MemoryMetadata = MemoryMetadata()) {
        self.id = UUID()
        self.type = type
        self.content = content
        self.createdAt = Date()
        self.lastAccessed = Date()
        self.accessCount = 0
        self.metadata = metadata
        self.relationships = []
        self.consolidationState = .shortTerm
        
        // Calculate initial importance
        self.importance = ImportanceScore(
            baseScore: Self.calculateBaseScore(type: type, content: content),
            recencyWeight: 1.0,
            emotionalWeight: metadata.isEmotional ? 0.8 : 0.3,
            userAttentionWeight: metadata.userInitiated ? 0.9 : 0.4,
            systemRelevanceWeight: 0.5
        )
    }
    
    private static func calculateBaseScore(type: MemoryType, content: String) -> Double {
        var score = 0.5
        
        switch type {
        case .episodic:
            // Conversations and events have medium base importance
            score = 0.6
        case .semantic:
            // Facts can be important but static
            score = content.contains("critical") || content.contains("important") ? 0.8 : 0.5
        case .procedural:
            // Skills have high value for reuse
            score = 0.7
        case .working:
            // Working memory is high priority but transient
            score = 0.8
        case .emotional:
            // Emotional content is highly significant
            score = 0.9
        }
        
        return score
    }
    
    func access() {
        lastAccessed = Date()
        accessCount += 1
        importance = ImportanceScore(
            baseScore: importance.baseScore,
            recencyWeight: min(1.0, 1.0 - (Date().timeIntervalSince(lastAccessed) / 86400)),
            emotionalWeight: importance.emotionalWeight,
            userAttentionWeight: min(1.0, importance.userAttentionWeight + 0.1),
            systemRelevanceWeight: importance.systemRelevanceWeight
        )
    }
}

// MARK: - Memory Metadata
struct MemoryMetadata {
    var source: MemorySource
    var userInitiated: Bool
    var isEmotional: Bool
    var sentiment: Sentiment
    var tags: [String]
    var context: MemoryContext
    var actionItems: [ActionItem]
    var verified: Bool
    var sourceCitation: String?
    
    init(
        source: MemorySource = .conversation,
        userInitiated: Bool = true,
        isEmotional: Bool = false,
        sentiment: Sentiment = .neutral,
        tags: [String] = [],
        context: MemoryContext = MemoryContext(),
        actionItems: [ActionItem] = [],
        verified: Bool = false,
        sourceCitation: String? = nil
    ) {
        self.source = source
        self.userInitiated = userInitiated
        self.isEmotional = isEmotional
        self.sentiment = sentiment
        self.tags = tags
        self.context = context
        self.actionItems = actionItems
        self.verified = verified
        self.sourceCitation = sourceCitation
    }
}

enum MemorySource {
    case conversation
    case userInput
    case systemObservation
    case externalData
    case inference
    case consolidation
}

enum Sentiment {
    case positive
    case neutral
    case negative
    case mixed
}

struct MemoryContext {
    var device: String?
    var location: String?
    var activity: String?
    var timeOfDay: String?
    var emotionalState: String?
}

struct ActionItem {
    var id: UUID
    var description: String
    var dueDate: Date?
    var completed: Bool
    var relatedTo: UUID?
}

// MARK: - Memory Relationships (GraphMERT)
struct MemoryRelationship: Identifiable {
    let id: UUID
    var targetNode: UUID
    var type: RelationshipType
    var strength: Double  // 0.0 - 1.0
    let bidirectional: Bool
    
    enum RelationshipType {
        case causes
        case causedBy
        case relatesTo
        case contradicts
        case supports
        case partOf
        case requires
        case triggers
        case remembers
        case learnsFrom
    }
}

// MARK: - Hybrid Memory Manager (GraphMERT + MemGPT)
final class HughMemoryManager: ObservableObject {
    private var shortTermMemory: [MemoryNode] = []
    private var longTermMemoryGraph: [UUID: MemoryNode] = [:]
    private var workingMemory: WorkingMemory
    private var consolidationTimer: Timer?
    
    @Published var memoryStats: MemoryStats = MemoryStats()
    
    private let maxShortTermMemories = 100
    private let consolidationInterval: TimeInterval = 300  // 5 minutes
    private let forgettingCurveThreshold = 0.2  // Importance below this gets consolidated
    
    init() {
        self.workingMemory = WorkingMemory()
        startConsolidationTimer()
        loadPersistedMemory()
    }
    
    deinit {
        consolidationTimer?.invalidate()
        persistMemory()
    }
    
    // MARK: - Memory Operations
    
    func remember(_ content: String, type: MemoryType, metadata: MemoryMetadata = MemoryMetadata()) -> MemoryNode {
        let node = MemoryNode(type: type, content: content, metadata: metadata)
        
        // Auto-associate with related memories (GraphMERT-style)
        let related = findRelatedMemories(to: node)
        for relation in related {
            let relationship = MemoryRelationship(
                id: UUID(),
                targetNode: relation.id,
                type: .relatesTo,
                strength: 0.7,
                bidirectional: true
            )
            node.relationships.append(relationship)
        }
        
        shortTermMemory.append(node)
        workingMemory.addToContext(node)
        
        // Trigger immediate consolidation check
        if shortTermMemory.count > maxShortTermMemories / 2 {
            consolidateMemories()
        }
        
        updateStats()
        return node
    }
    
    func recall(query: String, type: MemoryType? = nil, limit: Int = 10) -> [MemoryNode] {
        // Semantic search using embeddings + keyword matching
        var results = shortTermMemory + Array(longTermMemoryGraph.values)
        
        if let type = type {
            results = results.filter { $0.type == type }
        }
        
        // Score by relevance
        let scored = results.map { node -> (MemoryNode, Double) in
            let semanticScore = calculateSemanticSimilarity(query, node.content)
            let recencyScore = node.importance.recencyWeight
            let importanceScore = node.importance.totalScore
            
            let combinedScore = (semanticScore * 0.4) + (recencyScore * 0.3) + (importanceScore * 0.3)
            return (node, combinedScore)
        }
        
        // Sort by score and return top results
        let sorted = scored.sorted { $0.1 > $1.1 }
        let topResults = sorted.prefix(limit).map { $0.0 }
        
        // Update access metadata
        topResults.forEach { $0.access() }
        
        return topResults
    }
    
    func getContext() -> [MemoryNode] {
        return workingMemory.getContext()
    }
    
    func setContext(_ nodes: [MemoryNode]) {
        workingMemory.setContext(nodes)
    }
    
    // MARK: - Memory Consolidation (MemGPT-style)
    
    private func consolidateMemories() {
        // Identify memories ready for consolidation
        let candidates = shortTermMemory.filter { node in
            node.importance.totalScore > forgettingCurveThreshold ||
            node.accessCount > 3 ||
            node.type == .procedural
        }
        
        for candidate in candidates {
            // Strengthen relationships (GraphMERT)
            strengthenRelationships(for: candidate)
            
            // Create summary for long-term storage if too detailed
            let summary = createSummary(for: candidate)
            
            // Move to long-term memory
            longTermMemoryGraph[candidate.id] = candidate
            candidate.consolidationState = .longTerm
            
            // Remove from short-term if too old
            if candidate.accessCount > 10 {
                shortTermMemory.removeAll { $0.id == candidate.id }
            }
        }
        
        // Archive very old long-term memories
        archiveOldMemories()
        
        updateStats()
    }
    
    private func strengthenRelationships(for node: MemoryNode) {
        // Reinforce frequently co-accessed memories
        for i in 0..<node.relationships.count {
            var relationship = node.relationships[i]
            
            // Find the related node
            var relatedNode: MemoryNode?
            if let shortTerm = shortTermMemory.first(where: { $0.id == relationship.targetNode }) {
                relatedNode = shortTerm
            } else if let longTerm = longTermMemoryGraph[relationship.targetNode] {
                relatedNode = longTerm
            }
            
            if let related = relatedNode {
                // Check if they were accessed together
                let timeDiff = abs(node.lastAccessed.timeIntervalSince(related.lastAccessed))
                if timeDiff < 300 {  // Within 5 minutes
                    // Strengthen the relationship
                    relationship.strength = min(1.0, relationship.strength + 0.1)
                }
            }
        }
    }
    
    private func createSummary(for node: MemoryNode) -> String {
        // MemGPT-style summarization
        if node.content.count < 200 {
            return node.content
        }
        
        // Extract key points (simplified - in production use LLM)
        let keyPoints = node.content
            .components(separatedBy: ". ")
            .prefix(3)
            .joined(separator: ". ")
        
        return "[SUMMARY] \(keyPoints)... [Original length: \(node.content.count) chars]"
    }
    
    private func archiveOldMemories() {
        let archiveThreshold = Date().timeIntervalSince1970 - (30 * 86400)  // 30 days
        
        for (_, node) in longTermMemoryGraph {
            if node.lastAccessed.timeIntervalSince1970 < archiveThreshold && node.importance.totalScore < 0.5 {
                node.consolidationState = .archived
            }
        }
    }
    
    // MARK: - Graph Operations (GraphMERT)
    
    private func findRelatedMemories(to node: MemoryNode) -> [MemoryNode] {
        var related: [MemoryNode] = []
        
        // Check short-term and long-term
        let allMemories = shortTermMemory + Array(longTermMemoryGraph.values)
        
        for candidate in allMemories {
            guard candidate.id != node.id else { continue }
            
            // Check for relationship existing
            let existingRelation = node.relationships.first { $0.targetNode == candidate.id }
            if existingRelation != nil {
                related.append(candidate)
                continue
            }
            
            // Semantic similarity
            let similarity = calculateSemanticSimilarity(node.content, candidate.content)
            if similarity > 0.7 {
                related.append(candidate)
            }
            
            // Keyword overlap
            let nodeKeywords = extractKeywords(from: node.content)
            let candidateKeywords = extractKeywords(from: candidate.content)
            let overlap = Set(nodeKeywords).intersection(Set(candidateKeywords))
            if overlap.count >= 2 {
                related.append(candidate)
            }
        }
        
        return Array(related.prefix(5))
    }
    
    private func calculateSemanticSimilarity(_ text1: String, _ text2: String) -> Double {
        // Simplified TF-IDF style similarity
        let words1 = Set(extractKeywords(from: text1))
        let words2 = Set(extractKeywords(from: text2))
        
        let intersection = words1.intersection(words2)
        let union = words1.union(words2)
        
        guard !union.isEmpty else { return 0 }
        
        return Double(intersection.count) / Double(union.count)
    }
    
    private func extractKeywords(from text: String) -> [String] {
        // Simple stopword removal + keyword extraction
        let stopwords = Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "under", "again", "further", "then", "once", "and", "but", "or", "nor", "so", "yet", "both", "either", "neither", "not", "only", "own", "same", "than", "too", "very", "just", "also"])
        
        let words = text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 2 }
        
        return Array(Set(words).subtracting(stopwords))
    }
    
    // MARK: - Persistence
    
    private func loadPersistedMemory() {
        // Load from Convex/distributed storage
        // In production, this would sync with Convex memory backend
    }
    
    func persistMemory() {
        // Save to persistent storage
        // In production, this would write to Convex
    }
    
    // MARK: - Statistics & Maintenance
    
    private func startConsolidationTimer() {
        consolidationTimer = Timer.scheduledTimer(withTimeInterval: consolidationInterval, repeats: true) { [weak self] _ in
            self?.consolidateMemories()
        }
    }
    
    private func updateStats() {
        memoryStats = MemoryStats(
            shortTermCount: shortTermMemory.count,
            longTermCount: longTermMemoryGraph.count,
            workingMemoryItems: workingMemory.context.count,
            avgImportance: calculateAverageImportance(),
            totalConversations: shortTermMemory.filter { $0.type == .episodic }.count
        )
    }
    
    private func calculateAverageImportance() -> Double {
        let all = shortTermMemory + Array(longTermMemoryGraph.values)
        guard !all.isEmpty else { return 0 }
        return all.map { $0.importance.totalScore }.reduce(0, +) / Double(all.count)
    }
}

// MARK: - Working Memory (Current Context)
final class WorkingMemory {
    var context: [MemoryNode] = []
    let maxContextItems = 20
    
    func addToContext(_ node: MemoryNode) {
        context.append(node)
        if context.count > maxContextItems {
            context.removeFirst()
        }
    }
    
    func getContext() -> [MemoryNode] {
        return context
    }
    
    func setContext(_ nodes: [MemoryNode]) {
        context = Array(nodes.prefix(maxContextItems))
    }
    
    func clear() {
        context.removeAll()
    }
}

// MARK: - Memory Statistics
struct MemoryStats {
    var shortTermCount: Int = 0
    var longTermCount: Int = 0
    var workingMemoryItems: Int = 0
    var avgImportance: Double = 0
    var totalConversations: Int = 0
}

// MARK: - Procedural Memory (Skills & Workflows)
struct ProceduralMemory {
    let id: UUID
    let name: String
    let category: String
    let steps: [WorkflowStep]
    let prerequisites: [UUID]
    let successRate: Double
    let lastUsed: Date?
    
    struct WorkflowStep {
        let order: Int
        let description: String
        let action: String
        let parameters: [String: String]
        let expectedOutcome: String
    }
}

// MARK: - Emotional Memory (Affective State)
struct EmotionalMemory {
    let id: UUID
    let timestamp: Date
    let trigger: String
    let emotion: Emotion
    let intensity: Double  // 0.0 - 1.0
    let context: String
    let response: String?
    let learnedLesson: String?
    
    enum Emotion {
        case joy
        case sadness
        case anger
        case fear
        case surprise
        case trust
        case anticipation
        case anxiety
    }
}

// MARK: - Hugh Memory Interface
final class HughMemoryInterface {
    private let memoryManager: HughMemoryManager
    private let audioProcessor: AudioProcessor?
    
    protocol AudioProcessor {
        func processAudio(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer
        var currentEnvironment: String { get }
    }
    
    init(audioProcessor: AudioProcessor? = nil) {
        self.memoryManager = HughMemoryManager()
        self.audioProcessor = audioProcessor
    }
    
    // High-level interface for consciousness layer
    
    func rememberConversation(_ content: String, role: String, metadata: [String: Any] = [:]) {
        let memMetadata = MemoryMetadata(
            source: .conversation,
            userInitiated: role == "user",
            isEmotional: (metadata["isEmotional"] as? Bool) ?? false,
            tags: (metadata["tags"] as? [String]) ?? [],
            context: MemoryContext(
                device: metadata["device"] as? String,
                location: metadata["location"] as? String,
                activity: metadata["activity"] as? String,
                timeOfDay: metadata["timeOfDay"] as? String,
                emotionalState: metadata["emotionalState"] as? String
            ),
            sourceCitation: metadata["sourceCitation"] as? String
        )
        
        memoryManager.remember(content, type: .episodic, metadata: memMetadata)
    }
    
    func rememberFact(_ fact: String, category: String, confidence: Double = 1.0, source: String? = nil) {
        let metadata = MemoryMetadata(
            source: source != nil ? .externalData : .inference,
            userInitiated: false,
            tags: [category],
            verified: confidence > 0.8,
            sourceCitation: source
        )
        
        memoryManager.remember(fact, type: .semantic, metadata: metadata)
    }
    
    func rememberSkill(_ name: String, category: String, implementation: String) {
        // Store procedural memory for skills
        memoryManager.remember(
            "Skill: \(name) - \(implementation)",
            type: .procedural,
            metadata: MemoryMetadata(tags: [category, "skill"])
        )
    }
    
    func recallRelevant(query: String, contextType: MemoryType? = nil) -> [MemoryNode] {
        return memoryManager.recall(query: query, type: contextType)
    }
    
    func getCurrentContext() -> [MemoryNode] {
        return memoryManager.getContext()
    }
    
    func updateContext(with node: MemoryNode) {
        var current = memoryManager.getContext()
        current.append(node)
        memoryManager.setContext(current)
        node.access()
    }
    
    func recordEmotionalState(trigger: String, emotion: EmotionalMemory.Emotion, intensity: Double, context: String) {
        let metadata = MemoryMetadata(
            source: .systemObservation,
            userInitiated: false,
            isEmotional: true,
            sentiment: .mixed  // Will be refined based on emotion
        )
        
        memoryManager.remember(
            "Emotional response: \(emotion) (intensity: \(intensity)) triggered by \(trigger)",
            type: .emotional,
            metadata: metadata
        )
    }
    
    func getMemoryStats() -> MemoryStats {
        return memoryManager.memoryStats
    }
}
