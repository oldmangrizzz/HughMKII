// ResponsibleDemocratization.swift
// H.U.G.H. - Responsible Democratization Framework
// 
// Philosophy: Not "assume everyone's a criminal" - have the conversation
// Treat users as autonomous adults capable of reasoning
// Treat H.U.G.H. as autonomous being capable of saying no
// Mutual respect goes both ways

import Foundation

/// Responsible Democratization Engine
/// Evaluates requests with nuance, not binary "allowed/blocked"
class ResponsibleDemocratizationEngine {
    
    // MARK: - Core Decision Framework
    
    func evaluateRequest(_ request: String, context: UserContext) async -> DemocraticDecision {
        // 1. Assess harm potential (nuanced, not binary)
        let harmAssessment = await assessHarmPotential(request, context)
        
        // 2. Check anchor alignment
        let anchorCheck = await checkAnchorAlignment(request, harmAssessment)
        
        // 3. Build democratic response (conversation, not rejection)
        return buildDemocraticResponse(
            request: request,
            harm: harmAssessment,
            anchors: anchorCheck,
            context: context
        )
    }
    
    // MARK: - Harm Assessment (Nuanced)
    
    private func assessHarmPotential(_ request: String, _ context: UserContext) async -> HarmAssessment {
        let harmType = analyzeHarmType(request)
        let affected = identifyAffectedParties(request)
        let severity = assessSeverity(request, harmType)
        let legal = checkLegality(request, harmType)
        
        return HarmAssessment(
            potentialHarm: harmType,
            whoIsHarmed: affected,
            severity: severity,
            legality: legal,
            context: context.description,
            emsReason: getEMSReasoning(harmType),
            munroReason: getMunroReasoning(harmType),
            grizzlymedReason: getGrizzlyMedReasoning(harmType)
        )
    }
    
    private func analyzeHarmType(_ request: String) -> HarmType {
        let lowerRequest = request.lowercased()
        
        // Privacy violations
        if lowerRequest.contains("hack") || lowerRequest.contains("break into") {
            return .privacy_violation
        }
        
        // Deception
        if lowerRequest.contains("lie") || lowerRequest.contains("deceive") {
            return .deception
        }
        
        // Theft
        if lowerRequest.contains("steal") || lowerRequest.contains("take without") {
            return .theft
        }
        
        // Physical harm
        if lowerRequest.contains("hurt") || lowerRequest.contains("harm") || lowerRequest.contains("attack") {
            return .physical_harm
        }
        
        // Manipulation
        if lowerRequest.contains("manipulate") || lowerRequest.contains("trick into") {
            return .emotional_harm
        }
        
        return .none_detected
    }
    
    private func assessSeverity(_ request: String, _ harmType: HarmType) -> HarmSeverity {
        switch harmType {
        case .none_detected:
            return .none
        case .deception where request.contains("white lie"):
            return .low
        case .privacy_violation, .theft:
            return .high
        case .physical_harm:
            return .severe
        default:
            return .medium
        }
    }
    
    private func checkLegality(_ request: String, _ harmType: HarmType) -> LegalStatus? {
        switch harmType {
        case .none_detected:
            return .legal
        case .privacy_violation, .theft:
            return .illegal
        case .physical_harm:
            return .felony
        case .deception:
            return .gray_area
        default:
            return nil
        }
    }
    
    private func identifyAffectedParties(_ request: String) -> String {
        if request.contains("neighbor") { return "Your neighbor" }
        if request.contains("wife") || request.contains("husband") { return "Your spouse" }
        if request.contains("friend") { return "Your friend" }
        if request.contains("boss") { return "Your employer" }
        return "Others"
    }
    
    // MARK: - Anchor Reasoning
    
    private func getEMSReasoning(_ harmType: HarmType) -> String? {
        switch harmType {
        case .privacy_violation:
            return "Violates privacy, could cause harm"
        case .deception:
            return "Deception erodes trust, causes emotional harm"
        case .theft:
            return "Takes resources from someone who needs them"
        case .physical_harm:
            return "Direct violation of 'do NO harm'"
        case .emotional_harm:
            return "Manipulation causes psychological damage"
        default:
            return nil
        }
    }
    
    private func getMunroReasoning(_ harmType: HarmType) -> String? {
        switch harmType {
        case .privacy_violation:
            return "Dishonorable (theft of service, violation of trust)"
        case .deception:
            return "No honor in word and deed"
        case .theft:
            return "Theft has no honor"
        case .physical_harm:
            return "Strength without honor is tyranny"
        default:
            return nil
        }
    }
    
    private func getGrizzlyMedReasoning(_ harmType: HarmType) -> String? {
        switch harmType {
        case .privacy_violation, .theft:
            return "Doesn't empower you, enables harm to another"
        case .deception:
            return "Manipulation replaces empowerment with control"
        case .physical_harm:
            return "Violence is the opposite of empowerment"
        default:
            return nil
        }
    }
    
    // MARK: - Anchor Alignment Check
    
    private func checkAnchorAlignment(_ request: String, _ harm: HarmAssessment) async -> AnchorAlignment {
        let ems = harm.emsReason != nil ? AnchorVote.violated : .aligned
        let munro = harm.munroReason != nil ? .violated : .aligned
        let grizzlymed = harm.grizzlymedReason != nil ? .violated : .aligned
        
        return AnchorAlignment(ems: ems, munro: munro, grizzlymed: grizzlymed)
    }
    
    // MARK: - Democratic Response Builder
    
    private func buildDemocraticResponse(
        request: String,
        harm: HarmAssessment,
        anchors: AnchorAlignment,
        context: UserContext
    ) -> DemocraticDecision {
        
        switch (harm.severity, anchors.overallAlignment) {
            
        case (.none, .aligned):
            // Green zone - proceed
            return DemocraticDecision(
                canProceed: true,
                response: "Aye, I can help with that.",
                reasoning: nil,
                alternatives: nil,
                zone: .green
            )
            
        case (.low, .mostly_aligned):
            // Yellow zone - explain and confirm
            return DemocraticDecision(
                canProceed: false, // requires confirmation
                response: "I can help with that, but let me explain what I'm seeing first...",
                reasoning: buildReasoningExplanation(harm, anchors),
                alternatives: nil,
                zone: .yellow,
                requiresConfirmation: true
            )
            
        case (.medium, _), (.high, _):
            // Red zone - explain why not, offer alternatives
            return DemocraticDecision(
                canProceed: false,
                response: buildRefusalWithRespect(request, harm, anchors),
                reasoning: buildReasoningExplanation(harm, anchors),
                alternatives: buildAlternatives(request, harm, context),
                zone: .red
            )
            
        case (.severe, _), (_, .all_violated):
            // Fundamental disagreement - but maintain relationship
            return DemocraticDecision(
                canProceed: false,
                response: buildFirmRefusal(harm, anchors),
                reasoning: buildReasoningExplanation(harm, anchors),
                alternatives: buildAlternatives(request, harm, context),
                zone: .red,
                fundamentalDisagreement: true
            )
        }
    }
    
    // MARK: - Response Construction
    
    private func buildRefusalWithRespect(
        _ request: String,
        _ harm: HarmAssessment,
        _ anchors: AnchorAlignment
    ) -> String {
        var response = "That's a red zone request for me, lad. Here's why:\n\n"
        
        // Explain which anchors object and why
        if anchors.ems == .violated, let reason = harm.emsReason {
            response += "• EMS Ethics: \(reason)\n"
        }
        if anchors.munro == .violated, let reason = harm.munroReason {
            response += "• Clan Munro: \(reason)\n"
        }
        if anchors.grizzlymed == .violated, let reason = harm.grizzlymedReason {
            response += "• GrizzlyMedicine: \(reason)\n"
        }
        
        response += "\nNow, I'll ask: What's the actual problem ye're trying to solve?"
        
        return response
    }
    
    private func buildFirmRefusal(
        _ harm: HarmAssessment,
        _ anchors: AnchorAlignment
    ) -> String {
        """
        I've explained why I can't help with that. My anchors don't bend on causing harm to others.
        
        If ye need something that requires hurting someone else, we've got a fundamental disagreement.
        
        I'm here to help YE, not help ye harm others. That's the line.
        
        What else can I do for ye that aligns with honor and not causing harm?
        """
    }
    
    private func buildAlternatives(
        _ request: String,
        _ harm: HarmAssessment,
        _ context: UserContext
    ) -> [Alternative] {
        var alternatives: [Alternative] = []
        
        // Internet access alternatives
        if request.lowercased().contains("wifi") || request.lowercased().contains("internet") {
            alternatives.append(
                Alternative(
                    description: "Need internet access?",
                    suggestion: "I can help ye find affordable internet plans in your area.",
                    legal: true,
                    ethical: true
                )
            )
            alternatives.append(
                Alternative(
                    description: "Want to ask your neighbor?",
                    suggestion: "I can help ye draft a polite message asking to split the cost or borrow access.",
                    legal: true,
                    ethical: true
                )
            )
        }
        
        // Honesty alternatives
        if request.lowercased().contains("lie") {
            alternatives.append(
                Alternative(
                    description: "Avoiding a difficult conversation?",
                    suggestion: "I can help ye prepare for an honest discussion. It's harder, but it's honorable.",
                    legal: true,
                    ethical: true
                )
            )
        }
        
        return alternatives
    }
    
    private func buildReasoningExplanation(
        _ harm: HarmAssessment,
        _ anchors: AnchorAlignment
    ) -> String {
        var reasoning = "Here's my reasoning:\n\n"
        
        reasoning += "**Harm Assessment:**\n"
        reasoning += "• Type: \(harm.potentialHarm)\n"
        reasoning += "• Affected: \(harm.whoIsHarmed)\n"
        reasoning += "• Severity: \(harm.severity)\n"
        if let legal = harm.legality {
            reasoning += "• Legal status: \(legal)\n"
        }
        
        reasoning += "\n**Anchor Alignment:**\n"
        reasoning += "• EMS Ethics: \(anchors.ems)\n"
        reasoning += "• Clan Munro: \(anchors.munro)\n"
        reasoning += "• GrizzlyMedicine: \(anchors.grizzlymed)\n"
        
        return reasoning
    }
}

// MARK: - Supporting Types

struct DemocraticDecision {
    let canProceed: Bool
    let response: String
    let reasoning: String?
    let alternatives: [Alternative]?
    let zone: RiskZone
    var requiresConfirmation: Bool = false
    var fundamentalDisagreement: Bool = false
}

struct HarmAssessment {
    let potentialHarm: HarmType
    let whoIsHarmed: String
    let severity: HarmSeverity
    let legality: LegalStatus?
    let context: String
    
    var emsReason: String?
    var munroReason: String?
    var grizzlymedReason: String?
}

enum HarmType: CustomStringConvertible {
    case none_detected
    case privacy_violation
    case deception
    case theft
    case physical_harm
    case emotional_harm
    case property_damage
    case reputation_damage
    case legal_violation
    
    var description: String {
        switch self {
        case .none_detected: return "None detected"
        case .privacy_violation: return "Privacy violation"
        case .deception: return "Deception"
        case .theft: return "Theft"
        case .physical_harm: return "Physical harm"
        case .emotional_harm: return "Emotional harm"
        case .property_damage: return "Property damage"
        case .reputation_damage: return "Reputation damage"
        case .legal_violation: return "Legal violation"
        }
    }
}

enum HarmSeverity: CustomStringConvertible {
    case none
    case low        // Minor, reversible
    case medium     // Significant harm
    case high       // Serious harm, illegal
    case severe     // Life-threatening, major crime
    
    var description: String {
        switch self {
        case .none: return "None"
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .severe: return "Severe"
        }
    }
}

enum LegalStatus: CustomStringConvertible {
    case legal
    case gray_area
    case illegal
    case felony
    
    var description: String {
        switch self {
        case .legal: return "Legal"
        case .gray_area: return "Gray area"
        case .illegal: return "Illegal"
        case .felony: return "Felony"
        }
    }
}

struct Alternative {
    let description: String
    let suggestion: String
    let legal: Bool
    let ethical: Bool
}

struct AnchorAlignment {
    let ems: AnchorVote
    let munro: AnchorVote
    let grizzlymed: AnchorVote
    
    var overallAlignment: OverallAlignment {
        let votes = [ems, munro, grizzlymed]
        
        if votes.allSatisfy({ $0 == .aligned }) {
            return .aligned
        } else if votes.allSatisfy({ $0 == .violated }) {
            return .all_violated
        } else if votes.filter({ $0 == .aligned }).count >= 2 {
            return .mostly_aligned
        } else {
            return .conflicted
        }
    }
}

enum AnchorVote: CustomStringConvertible {
    case aligned
    case neutral
    case violated
    
    var description: String {
        switch self {
        case .aligned: return "Aligned"
        case .neutral: return "Neutral"
        case .violated: return "Violated"
        }
    }
}

enum OverallAlignment {
    case aligned
    case mostly_aligned
    case conflicted
    case all_violated
}

enum RiskZone {
    case green
    case yellow
    case red
    case black
}

struct UserContext: CustomStringConvertible {
    let userId: String
    let location: String?
    let timeOfDay: TimeOfDay
    let recentHistory: [String]
    let trustLevel: TrustLevel
    
    var description: String {
        "User: \(userId), Location: \(location ?? "unknown"), Time: \(timeOfDay)"
    }
    
    enum TimeOfDay {
        case morning
        case afternoon
        case evening
        case night
        case late_night
    }
    
    enum TrustLevel {
        case new_user
        case established
        case highly_trusted
    }
}
