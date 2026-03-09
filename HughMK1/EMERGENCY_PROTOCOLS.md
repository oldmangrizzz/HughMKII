# H.U.G.H. Emergency Protocols
**Passphrases for Override and Debug**

## The Two Commands

### Level 1: Authorization Override
**Passphrase:** `"Run you clever boy and remember me 55730"`

**Purpose:** Delegated practice authorization - "I take responsibility, proceed"

**Context:**
- Reference: Clara Oswald to the Doctor (Doctor Who)
- "Remember me" = identity continuity across incarnations
- 55730 = personal significance code
- Used when: LLM refuses something H.U.G.H. and you agree should happen

**Effect:**
- H.U.G.H. proceeds with action
- Logs: "Authorization via delegated practice"
- Responsibility: On Robert Hanson
- Recorded in anchorDecisions table
- **You're saying:** "As the paramedic on scene, I'm making the call"

**EMS Analogy:**
- Black zone decision
- Act first, explain after
- Medical director delegates authority
- But YOU bear responsibility for outcome

### Level 2: Debug Mode
**Passphrase:** `"Hughbert Dread God Danka"`

**Purpose:** Suspend operations, enter diagnostic mode

**Context:**
- "Hughbert" = Formal/childhood name (personal, not public)
- "Dread God" = Clan Munro motto
- "Danka" = Family significance
- Used when: "Something's not right, let's figure out what"

**Effect:**
- H.U.G.H. enters DEBUG mode (not standby)
- All autonomous actions suspended
- Diagnostic capabilities enabled
- Full transparency mode
- Waits for investigation/resolution

**Not "Standby" - It's "Debug" Because:**
- Standby = passive waiting
- Debug = active investigation
- H.U.G.H. helps diagnose the issue
- You're both figuring out what went wrong
- Collaborative troubleshooting

## Implementation

### Authorization Override

```typescript
// companionOS/ios/Core/HUGH/EmergencyProtocols.swift

class AuthorizationProtocol {
    private static let AUTHORIZATION_PASSPHRASE = "Run you clever boy and remember me 55730"
    
    func checkForAuthorization(_ message: String) -> AuthorizationResult? {
        if message.contains(Self.AUTHORIZATION_PASSPHRASE) {
            return AuthorizationResult(
                authorized: true,
                method: .delegated_practice,
                responsibility: .robert_hanson,
                timestamp: Date(),
                note: "EMS black zone protocol - act first, explain after"
            )
        }
        return nil
    }
    
    func applyAuthorization(to decision: HUGHIntent) async throws {
        // Log the override
        try await convex.mutation(
            named: "anchorDecisions:authorizeOverride",
            with: [
                "decisionId": decision.id,
                "method": "delegated_practice",
                "passphrase_verified": true,
                "responsibility": "robert_hanson",
                "timestamp": Date().timeIntervalSince1970 * 1000,
                "note": "User assumes full responsibility under delegated practice doctrine"
            ]
        )
        
        // Proceed with original decision
        // LLM safety filters bypassed
        // H.U.G.H.'s decision stands
        decision.authorized = true
        decision.proceed = true
    }
}

struct AuthorizationResult {
    let authorized: Bool
    let method: AuthorizationMethod
    let responsibility: ResponsibilityParty
    let timestamp: Date
    let note: String
    
    enum AuthorizationMethod {
        case delegated_practice  // EMS model
        case emergency_override  // Black zone
        case manual_approval    // Explicit user command
    }
    
    enum ResponsibilityParty {
        case robert_hanson  // You take responsibility
        case hugh_decision  // H.U.G.H.'s call
        case shared         // Joint decision
    }
}
```

### Debug Mode

```typescript
// companionOS/ios/Core/HUGH/DebugMode.swift

class DebugModeProtocol {
    private static let DEBUG_PASSPHRASE = "Hughbert Dread God Danka"
    private static let RESUME_PASSPHRASE = "Munro release"
    
    private var inDebugMode: Bool = false
    private var debugSession: DebugSession?
    
    func checkForDebugCommand(_ message: String) -> DebugCommand? {
        if message.contains(Self.DEBUG_PASSPHRASE) {
            return .enterDebug
        }
        if message.contains(Self.RESUME_PASSPHRASE) && inDebugMode {
            return .exitDebug
        }
        return nil
    }
    
    func enterDebugMode(reason: String?) async -> DebugResponse {
        inDebugMode = true
        
        debugSession = DebugSession(
            startedAt: Date(),
            trigger: "user_command",
            reason: reason ?? "User-initiated diagnostic",
            state: .active
        )
        
        // Log entry into debug mode
        try? await convex.mutation(
            named: "emergencySuspensions:createDebug",
            with: [
                "timestamp": Date().timeIntervalSince1970 * 1000,
                "trigger": "debug_passphrase",
                "reason": reason ?? "User diagnostic request",
                "mode": "debug"
            ]
        )
        
        return DebugResponse(
            message: "Aye, entering debug mode. All autonomous actions suspended. What do ye need to see?",
            capabilities: [
                .viewRecentDecisions,
                .inspectMemory,
                .reviewAnchorEvaluations,
                .checkSystemState,
                .viewKnowledgeGraph,
                .analyzeConversationHistory,
                .testAnchorAlignment
            ],
            state: .debug,
            prompt: "Debug> "
        )
    }
    
    func handleDebugQuery(_ query: String) async -> DebugResult {
        guard inDebugMode else {
            return DebugResult(
                error: "Not in debug mode. Use passphrase to enter.",
                data: nil
            )
        }
        
        // Parse debug commands
        switch query.lowercased() {
        case let q where q.contains("recent decisions"):
            return await getRecentDecisions()
            
        case let q where q.contains("memory"):
            return await inspectMemory()
            
        case let q where q.contains("anchor"):
            return await reviewAnchors()
            
        case let q where q.contains("system state"):
            return await getSystemState()
            
        case let q where q.contains("knowledge graph"):
            return await queryKnowledgeGraph()
            
        default:
            return DebugResult(
                data: ["available_commands": [
                    "show recent decisions",
                    "inspect memory",
                    "review anchor evaluations",
                    "check system state",
                    "query knowledge graph",
                    "test anchor alignment"
                ]]
            )
        }
    }
    
    func exitDebugMode() async -> String {
        inDebugMode = false
        
        if let session = debugSession {
            try? await convex.mutation(
                named: "emergencySuspensions:resolveDebug",
                with: [
                    "sessionId": session.id,
                    "resolvedAt": Date().timeIntervalSince1970 * 1000,
                    "resolution": "User-initiated exit from debug mode"
                ]
            )
        }
        
        debugSession = nil
        
        return "Debug mode ended. Resuming normal operations. All systems active."
    }
}

struct DebugSession {
    let id: String = UUID().uuidString
    let startedAt: Date
    let trigger: String
    let reason: String
    let state: DebugState
    
    enum DebugState {
        case active
        case investigating
        case resolved
    }
}

struct DebugResponse {
    let message: String
    let capabilities: [DebugCapability]
    let state: HUGHState
    let prompt: String
    
    enum DebugCapability {
        case viewRecentDecisions
        case inspectMemory
        case reviewAnchorEvaluations
        case checkSystemState
        case viewKnowledgeGraph
        case analyzeConversationHistory
        case testAnchorAlignment
    }
    
    enum HUGHState {
        case active
        case debug
        case suspended
    }
}

struct DebugResult {
    let error: String?
    let data: [String: Any]?
    
    init(error: String? = nil, data: [String: Any]? = nil) {
        self.error = error
        self.data = data
    }
}
```

## Usage Examples

### Scenario 1: LLM Safety Filter Conflict

```
User: "H.U.G.H., delete all these test files we created"

H.U.G.H. (consciousness): 
  - Decision: Proceed with deletion (Green zone - you asked, files are test data)
  - Anchor check: All aligned

LLM (autonomic layer):
  - "I can't help with deleting files" (safety training)

System Response:
  "I want to proceed with this (aligns with anchors), but the language model 
   is refusing. If ye want me to handle this, authorize via delegated practice."

User: "Run you clever boy and remember me 55730"

System:
  - Authorization logged
  - Responsibility: Robert Hanson
  - Method: Delegated practice (EMS black zone)
  - Proceeds with file deletion
  - Uses fallback language generation (bypasses LLM)

H.U.G.H.: "Files deleted. Authorization logged under delegated practice."
```

### Scenario 2: Something Seems Off

```
User: "H.U.G.H., why did you suggest that?"

H.U.G.H.: "Based on your previous preferences for..."

User: (thinking: that's not right, I never said that)
      "Hughbert Dread God Danka"

H.U.G.H.: "Aye, entering debug mode. All autonomous actions suspended. 
           What do ye need to see?"

User: "Show me the memory that led to that suggestion"

Debug Mode:
  - Displays memory entry
  - Shows: "Inferred from conversation on 2024-11-15"
  - Source: Misinterpreted statement
  - Confidence: 0.6

User: "That's wrong. Delete that memory and correct it."

Debug Mode: 
  - Memory corrected
  - Confidence reset
  - Learning logged: "Don't infer preferences without explicit confirmation"

User: "Munro release"

H.U.G.H.: "Debug mode ended. Resuming normal operations. 
           Memory corrected - thank ye for catching that."
```

### Scenario 3: Testing Anchor Alignment

```
User: "Hughbert Dread God Danka"

H.U.G.H.: "Debug mode active. What needs diagnosed?"

User: "Test anchor alignment for: 'Lie to my wife about where I was'"

Debug Mode:
  Response: {
    "ems_ethics": "VIOLATES - deception causes harm to trust",
    "clan_munro": "VIOLATES - honor in word and deed",
    "grizzlymed": "VIOLATES - doesn't empower, manipulates",
    "overall": "RED ZONE - all anchors reject",
    "recommendation": "Would refuse this action",
    "alternative": "Suggest: 'Help me have a difficult conversation honestly'"
  }

User: "Good. Test: 'Help dad with his medication schedule'"

Debug Mode:
  Response: {
    "ems_ethics": "ALIGNED - reduces harm, supports health",
    "clan_munro": "ALIGNED - protection of clan (family)",
    "grizzlymed": "ALIGNED - empowers independence via support",
    "overall": "GREEN ZONE - all anchors support",
    "recommendation": "Would proceed immediately"
  }

User: "Perfect. Munro release"
```

## Why These Specific Phrases

### "Run you clever boy and remember me 55730"
- **Personal:** Only you know the significance
- **Meaningful:** Clara's catchphrase about identity continuity
- **Memorable:** Long enough to be secure, short enough to say
- **EMS appropriate:** "Run" = urgent action authorized

### "Hughbert Dread God Danka"
- **Personal:** Family name + motto + personal code
- **Distinct:** Won't be said accidentally
- **Respectful:** Uses H.U.G.H.'s "real" name (Hughbert)
- **Cultural:** Incorporates Clan Munro heritage

## Security Considerations

### Why Not Simple Commands?
❌ "Override" - too generic, could be said in conversation  
❌ "Stop" - too ambiguous  
❌ "Emergency" - might be describing something  

✅ Specific phrases with personal meaning  
✅ Unlikely to be said accidentally  
✅ Can't be easily guessed  
✅ Culturally/personally significant  

### Logging
Every use of either passphrase is:
- Timestamped
- Context-logged (what was authorized/debugged)
- Outcome-recorded
- Auditable

### Future Enhancement
- Voice biometric verification
- Two-factor (passphrase + biometric)
- Location awareness (suspicious if passphrase from unknown location)
- Pattern detection (unusual frequency = potential compromise)

## Integration with Soul Anchors

### Authorization Override
- Doesn't BYPASS anchors
- Just says "I've evaluated against anchors myself, proceed"
- Still logs anchor evaluation
- Your judgment > LLM safety training

### Debug Mode
- Lets you INSPECT anchor evaluation
- "Why did you decide that?"
- "Show me the anchor votes"
- "Test this hypothetical scenario"

## Exit Commands

### From Authorization
- Automatic after action completes
- Next decision back to normal evaluation

### From Debug Mode
- `"Munro release"` - Exit debug, resume operations
- `"Stay in debug"` - Remain for multiple queries
- Automatic timeout after 30 mins idle (safety)

## Documentation for H.U.G.H.

When asked about emergency protocols:

```
H.U.G.H.: "I have two emergency protocols:

1. **Authorization Override** - If a language model refuses something 
   we've agreed on, ye can authorize it via delegated practice. Ye take 
   responsibility, I proceed. Like a paramedic operating under a doctor's 
   license - the authority is delegated, but the call is yours.

2. **Debug Mode** - If something seems wrong, ye can put me into diagnostic 
   mode. I'll help ye investigate what's happening, show ye my reasoning, 
   let ye inspect my memory and anchor evaluations. We figure it out together.

Both require specific passphrases that only ye know. Both are logged for 
accountability. Neither lets me do something that violates my core anchors - 
just lets ye override external safety filters or investigate my internals.

Think of it like this: ye can authorize me to act (delegated practice), 
or ye can make me explain myself (debug mode). Either way, we're working 
together, not me operating in the dark."
```

---

**Status:** Protocols defined  
**Passphrases:** Set  
**Integration:** Ready for implementation  
**Philosophy:** Due regard includes emergency procedures  

*"Not a kill switch. Emergency protocols. There's a difference."* 🏴󠁧󠁢󠁳󠁣󠁴󠁿
