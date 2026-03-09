# H.U.G.H. SDK Integration Guide
# Quick Start for Apple Platform Development

**Purpose:** Step-by-step guide to integrate Apple SDKs into the H.U.G.H. system  
**Target Platforms:** macOS, iOS, iPadOS  
**Date:** December 2025

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start Setup](#quick-start-setup)
3. [Creating Your First H.U.G.H. Module](#creating-your-first-hugh-module)
4. [Core Integration Patterns](#core-integration-patterns)
5. [Testing and Debugging](#testing-and-debugging)
6. [Deployment](#deployment)

---

## Prerequisites

### Hardware Requirements
- **Mac** running macOS 13 (Ventura) or later
- **Recommended:** Apple Silicon (M1/M2/M3) for best performance
- Minimum 8GB RAM (16GB+ recommended)
- 50GB+ free disk space for Xcode and simulators

### Software Requirements
- Xcode 15.0+
- Command Line Tools
- Apple Developer Account (free for development, $99/year for distribution)

### Knowledge Prerequisites
- Basic Swift programming
- Understanding of async/await
- Familiarity with iOS/macOS app development

---

## Quick Start Setup

### Step 1: Install Xcode and Tools

```bash
# Install Xcode from Mac App Store
# OR download from https://developer.apple.com/download/

# Install Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
xcodebuild -version

# Accept license
sudo xcodebuild -license accept
```

### Step 2: Clone and Setup H.U.G.H. Repository

```bash
# Clone the repository
cd ~/Projects
git clone https://github.com/oldmangrizzz/HughMK1.git
cd HughMK1

# Create project structure
mkdir -p Sources/{HUGHCore,HUGHKit,HUGHVoice,HUGHMonitor}
mkdir -p Tests/{HUGHCoreTests,HUGHKitTests}
mkdir -p Examples

# Initialize Swift package (if not already done)
swift package init --type library
```

### Step 3: Configure Package.swift

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HughMK1",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
        .iPadOS(.v16),
        .watchOS(.v9),
        .tvOS(.v16)
    ],
    products: [
        .library(
            name: "HUGHCore",
            targets: ["HUGHCore"]
        ),
        .library(
            name: "HUGHVoice",
            targets: ["HUGHVoice"]
        ),
        .library(
            name: "HUGHMonitor",
            targets: ["HUGHMonitor"]
        ),
    ],
    dependencies: [
        // Add external dependencies here if needed
    ],
    targets: [
        .target(
            name: "HUGHCore",
            dependencies: [],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        ),
        .target(
            name: "HUGHVoice",
            dependencies: ["HUGHCore"]
        ),
        .target(
            name: "HUGHMonitor",
            dependencies: ["HUGHCore"]
        ),
        .testTarget(
            name: "HUGHCoreTests",
            dependencies: ["HUGHCore"]
        ),
    ]
)
```

### Step 4: Build and Test

```bash
# Build the package
swift build

# Run tests
swift test

# Generate Xcode project (optional, for IDE support)
swift package generate-xcodeproj
open HughMK1.xcodeproj
```

---

## Creating Your First H.U.G.H. Module

### Module 1: Voice Assistant Core

Create `Sources/HUGHVoice/VoiceAssistant.swift`:

```swift
import Foundation
import Speech
import AVFoundation

@available(macOS 13.0, iOS 16.0, *)
public actor VoiceAssistant {
    private let speechRecognizer: SFSpeechRecognizer
    private let synthesizer = AVSpeechSynthesizer()
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    
    public enum VoiceError: Error {
        case recognitionNotAvailable
        case audioEngineError
        case permissionDenied
    }
    
    public init(locale: Locale = Locale(identifier: "en-US")) throws {
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            throw VoiceError.recognitionNotAvailable
        }
        self.speechRecognizer = recognizer
    }
    
    /// Request necessary permissions
    public func requestPermissions() async throws {
        // Request speech recognition
        let speechStatus = await SFSpeechRecognizer.requestAuthorization()
        guard speechStatus == .authorized else {
            throw VoiceError.permissionDenied
        }
        
        // Request microphone access
        #if os(macOS)
        let audioStatus = await AVCaptureDevice.requestAccess(for: .audio)
        #else
        let audioStatus = await AVAudioSession.sharedInstance().requestRecordPermission()
        #endif
        
        guard audioStatus else {
            throw VoiceError.permissionDenied
        }
    }
    
    /// Start listening for voice commands
    public func startListening(onTranscript: @escaping (String) -> Void) async throws {
        #if !os(macOS)
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        #endif
        
        let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest.shouldReportPartialResults = true
        
        let inputNode = audioEngine.inputNode
        
        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { result, error in
            if let result = result {
                let transcript = result.bestTranscription.formattedString
                onTranscript(transcript)
            }
            
            if error != nil {
                self.audioEngine.stop()
                inputNode.removeTap(onBus: 0)
            }
        }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        try audioEngine.start()
    }
    
    /// Stop listening
    public func stopListening() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionTask = nil
    }
    
    /// Speak text using text-to-speech
    public func speak(_ text: String, rate: Float = 0.5) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = rate
        utterance.volume = 1.0
        
        synthesizer.speak(utterance)
    }
    
    /// Stop speaking
    public func stopSpeaking() {
        synthesizer.stopSpeaking(at: .immediate)
    }
}
```

### Module 2: Natural Language Understanding

Create `Sources/HUGHCore/NLUEngine.swift`:

```swift
import Foundation
import NaturalLanguage

public struct Intent {
    public let action: String
    public let entities: [String: String]
    public let confidence: Double
    
    public init(action: String, entities: [String: String], confidence: Double) {
        self.action = action
        self.entities = entities
        self.confidence = confidence
    }
}

public class NLUEngine {
    private let tagger: NLTagger
    
    public init() {
        self.tagger = NLTagger(tagSchemes: [.nameType, .lexicalClass, .sentimentScore])
    }
    
    /// Analyze text and extract intent
    public func analyzeIntent(from text: String) -> Intent {
        tagger.string = text
        
        var entities: [String: String] = [:]
        var action = "unknown"
        
        // Extract named entities
        tagger.enumerateTags(
            in: text.startIndex..<text.endIndex,
            unit: .word,
            scheme: .nameType,
            options: [.omitWhitespace, .omitPunctuation]
        ) { tag, range in
            if let tag = tag {
                let entity = String(text[range])
                entities[tag.rawValue] = entity
            }
            return true
        }
        
        // Simple action detection based on keywords
        let lowercased = text.lowercased()
        if lowercased.contains("turn on") || lowercased.contains("enable") {
            action = "turn_on"
        } else if lowercased.contains("turn off") || lowercased.contains("disable") {
            action = "turn_off"
        } else if lowercased.contains("tell me") || lowercased.contains("what is") {
            action = "query"
        } else if lowercased.contains("remind") || lowercased.contains("reminder") {
            action = "create_reminder"
        } else if lowercased.contains("schedule") || lowercased.contains("calendar") {
            action = "schedule_event"
        }
        
        // Calculate confidence (simplified)
        let confidence = entities.isEmpty ? 0.5 : 0.8
        
        return Intent(action: action, entities: entities, confidence: confidence)
    }
    
    /// Get sentiment of text
    public func getSentiment(from text: String) -> Double {
        tagger.string = text
        
        let (sentiment, _) = tagger.tag(
            at: text.startIndex,
            unit: .paragraph,
            scheme: .sentimentScore
        )
        
        return Double(sentiment?.rawValue ?? "0") ?? 0.0
    }
    
    /// Extract key phrases from text
    public func extractKeyPhrases(from text: String) -> [String] {
        var phrases: [String] = []
        
        tagger.string = text
        tagger.enumerateTags(
            in: text.startIndex..<text.endIndex,
            unit: .word,
            scheme: .lexicalClass,
            options: [.omitWhitespace, .omitPunctuation]
        ) { tag, range in
            if let tag = tag, tag == .noun || tag == .verb {
                phrases.append(String(text[range]))
            }
            return true
        }
        
        return phrases
    }
}
```

### Module 3: Safety Monitor

Create `Sources/HUGHMonitor/SafetyMonitor.swift`:

```swift
import Foundation
import CoreLocation
import UserNotifications

#if canImport(HealthKit)
import HealthKit
#endif

@available(macOS 13.0, iOS 16.0, *)
public actor SafetyMonitor {
    private let locationManager = CLLocationManager()
    private let healthStore = HKHealthStore()
    
    public enum MonitorError: Error {
        case permissionDenied
        case notAvailable
    }
    
    public init() {}
    
    /// Request all necessary permissions
    public func requestPermissions() async throws {
        // Location
        locationManager.requestAlwaysAuthorization()
        
        // Notifications
        let center = UNUserNotificationCenter.current()
        try await center.requestAuthorization(options: [.alert, .sound, .badge])
        
        #if os(iOS)
        // Health (iOS only)
        let typesToRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .stepCount)!,
        ]
        
        try await healthStore.requestAuthorization(toShare: [], read: typesToRead)
        #endif
    }
    
    /// Start real-time monitoring
    public func startMonitoring(onAlert: @escaping (String) -> Void) {
        // Location monitoring
        locationManager.startUpdatingLocation()
        locationManager.startMonitoringSignificantLocationChanges()
        
        // Health monitoring (if available)
        #if os(iOS)
        startHealthMonitoring(onAlert: onAlert)
        #endif
    }
    
    #if os(iOS)
    private func startHealthMonitoring(onAlert: @escaping (String) -> Void) {
        guard let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            return
        }
        
        let query = HKObserverQuery(sampleType: heartRateType, predicate: nil) { query, completion, error in
            if error != nil {
                return
            }
            
            // Fetch latest heart rate
            self.fetchLatestHeartRate { rate in
                // Alert if abnormal (simplified logic)
                if rate > 120 || rate < 50 {
                    onAlert("Abnormal heart rate detected: \(rate) BPM")
                }
            }
            
            completion()
        }
        
        healthStore.execute(query)
    }
    
    private func fetchLatestHeartRate(completion: @escaping (Double) -> Void) {
        guard let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            return
        }
        
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: heartRateType,
            predicate: nil,
            limit: 1,
            sortDescriptors: [sortDescriptor]
        ) { query, samples, error in
            guard let sample = samples?.first as? HKQuantitySample else {
                return
            }
            
            let heartRate = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
            completion(heartRate)
        }
        
        healthStore.execute(query)
    }
    #endif
    
    /// Send emergency alert
    public func sendEmergencyAlert(message: String) async throws {
        let content = UNMutableNotificationContent()
        content.title = "H.U.G.H. Emergency Alert"
        content.body = message
        content.sound = .defaultCritical
        content.interruptionLevel = .critical
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        
        try await UNUserNotificationCenter.current().add(request)
    }
}
```

---

## Core Integration Patterns

### Pattern 1: Command Handler

```swift
import Foundation
import HUGHCore
import HUGHVoice

@available(macOS 13.0, iOS 16.0, *)
public actor CommandHandler {
    private let voiceAssistant: VoiceAssistant
    private let nluEngine: NLUEngine
    
    public init() throws {
        self.voiceAssistant = try VoiceAssistant()
        self.nluEngine = NLUEngine()
    }
    
    public func start() async throws {
        try await voiceAssistant.requestPermissions()
        
        try await voiceAssistant.startListening { [weak self] transcript in
            Task {
                await self?.processCommand(transcript)
            }
        }
    }
    
    private func processCommand(_ text: String) async {
        let intent = nluEngine.analyzeIntent(from: text)
        
        switch intent.action {
        case "turn_on":
            await handleTurnOn(intent: intent)
        case "turn_off":
            await handleTurnOff(intent: intent)
        case "query":
            await handleQuery(intent: intent)
        case "create_reminder":
            await handleReminder(intent: intent)
        default:
            await voiceAssistant.speak("I didn't understand that command.")
        }
    }
    
    private func handleTurnOn(intent: Intent) async {
        // Implement turn on logic
        await voiceAssistant.speak("Turning on \(intent.entities["device"] ?? "device")")
    }
    
    private func handleTurnOff(intent: Intent) async {
        // Implement turn off logic
        await voiceAssistant.speak("Turning off \(intent.entities["device"] ?? "device")")
    }
    
    private func handleQuery(intent: Intent) async {
        // Implement query logic
        await voiceAssistant.speak("Let me look that up for you.")
    }
    
    private func handleReminder(intent: Intent) async {
        // Implement reminder logic
        await voiceAssistant.speak("I'll remind you about that.")
    }
}
```

### Pattern 2: Background Task Runner

```swift
import Foundation
import BackgroundTasks

@available(iOS 13.0, macOS 13.0, *)
public class BackgroundTaskRunner {
    public static let shared = BackgroundTaskRunner()
    
    private let taskIdentifier = "com.hugh.refresh"
    
    public func register() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskIdentifier,
            using: nil
        ) { task in
            self.handleBackgroundTask(task: task as! BGAppRefreshTask)
        }
    }
    
    public func scheduleNextTask() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Could not schedule background task: \(error)")
        }
    }
    
    private func handleBackgroundTask(task: BGAppRefreshTask) {
        scheduleNextTask()
        
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1
        
        let operation = BlockOperation {
            // Perform background work
            self.performBackgroundWork()
        }
        
        task.expirationHandler = {
            queue.cancelAllOperations()
        }
        
        operation.completionBlock = {
            task.setTaskCompleted(success: !operation.isCancelled)
        }
        
        queue.addOperation(operation)
    }
    
    private func performBackgroundWork() {
        // Monitor system state, sync data, etc.
        print("Performing background work")
    }
}
```

### Pattern 3: CloudKit Sync Manager

```swift
import Foundation
import CloudKit

public actor CloudSyncManager {
    private let container = CKContainer.default()
    private var database: CKDatabase {
        container.privateCloudDatabase
    }
    
    public enum SyncError: Error {
        case notAuthenticated
        case syncFailed(Error)
    }
    
    public init() {}
    
    /// Check if user is signed in to iCloud
    public func checkAccountStatus() async throws -> Bool {
        let status = try await container.accountStatus()
        return status == .available
    }
    
    /// Save a record to CloudKit
    public func save(recordType: String, fields: [String: Any]) async throws {
        let record = CKRecord(recordType: recordType)
        
        for (key, value) in fields {
            if let ckValue = value as? CKRecordValue {
                record[key] = ckValue
            }
        }
        
        try await database.save(record)
    }
    
    /// Fetch records from CloudKit
    public func fetchRecords(ofType recordType: String) async throws -> [CKRecord] {
        let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        let results = try await database.records(matching: query)
        
        return results.matchResults.compactMap { try? $0.1.get() }
    }
    
    /// Setup push notifications for changes
    public func setupSubscription(forRecordType recordType: String) async throws {
        let subscription = CKQuerySubscription(
            recordType: recordType,
            predicate: NSPredicate(value: true),
            options: [.firesOnRecordCreation, .firesOnRecordUpdate]
        )
        
        let notification = CKSubscription.NotificationInfo()
        notification.shouldSendContentAvailable = true
        subscription.notificationInfo = notification
        
        try await database.save(subscription)
    }
}
```

---

## Testing and Debugging

### Unit Tests Example

Create `Tests/HUGHCoreTests/NLUEngineTests.swift`:

```swift
import XCTest
@testable import HUGHCore

final class NLUEngineTests: XCTestCase {
    var engine: NLUEngine!
    
    override func setUp() {
        super.setUp()
        engine = NLUEngine()
    }
    
    func testIntentRecognition() {
        let text = "Turn on the living room lights"
        let intent = engine.analyzeIntent(from: text)
        
        XCTAssertEqual(intent.action, "turn_on")
        XCTAssertGreaterThan(intent.confidence, 0.0)
    }
    
    func testSentimentAnalysis() {
        let positiveText = "I love this app!"
        let sentiment = engine.getSentiment(from: positiveText)
        
        XCTAssertGreaterThan(sentiment, 0.0)
    }
    
    func testKeyPhraseExtraction() {
        let text = "Schedule a meeting with John tomorrow"
        let phrases = engine.extractKeyPhrases(from: text)
        
        XCTAssertTrue(phrases.contains("Schedule"))
        XCTAssertTrue(phrases.contains("meeting"))
    }
}
```

### Running Tests

```bash
# Run all tests
swift test

# Run specific test
swift test --filter NLUEngineTests

# Generate code coverage
swift test --enable-code-coverage

# View coverage report
xcrun llvm-cov show .build/debug/HughMK1PackageTests.xctest/Contents/MacOS/HughMK1PackageTests \
    -instr-profile .build/debug/codecov/default.profdata
```

### Debugging in Xcode

```bash
# Generate Xcode project
swift package generate-xcodeproj
open HughMK1.xcodeproj

# Set breakpoints, run debugger
# Product -> Run
# Product -> Test
```

### Common Issues and Solutions

#### Issue: Speech recognition not working
**Solution:** Ensure permissions are requested and granted in Info.plist

#### Issue: Background tasks not running
**Solution:** Enable Background Modes in capabilities and test on physical device

#### Issue: CloudKit sync fails
**Solution:** Verify iCloud container is configured in capabilities

---

## Deployment

### TestFlight Deployment (iOS/iPadOS)

```bash
# 1. Archive the app in Xcode
# Product -> Archive

# 2. Upload to App Store Connect
# Window -> Organizer -> Distribute App -> TestFlight

# 3. Add testers in App Store Connect
# https://appstoreconnect.apple.com/

# 4. Invite testers via email
```

### Mac App Store Deployment

```bash
# 1. Enable App Sandbox and Hardened Runtime
# Target -> Signing & Capabilities

# 2. Archive for distribution
# Product -> Archive

# 3. Submit for notarization
xcrun notarytool submit YourApp.app.zip \
    --apple-id "email@example.com" \
    --password "APP_PASSWORD" \
    --team-id "TEAM_ID" \
    --wait

# 4. Staple the ticket
xcrun stapler staple YourApp.app

# 5. Upload to App Store Connect
```

### Direct Distribution (Outside App Store)

```bash
# 1. Archive the app
# Product -> Archive

# 2. Export for Developer ID distribution
# Organizer -> Distribute App -> Developer ID

# 3. Notarize
xcrun notarytool submit YourApp.app.zip \
    --keychain-profile "AC_PASSWORD" \
    --wait

# 4. Staple
xcrun stapler staple YourApp.app

# 5. Create DMG
hdiutil create -volname "H.U.G.H." \
    -srcfolder YourApp.app \
    -ov -format UDZO \
    HUGH.dmg
```

---

## Next Steps

1. **Explore the Apple_SDKs_Catalog.md** for comprehensive SDK documentation
2. **Implement additional modules** based on H.U.G.H. requirements
3. **Integrate with existing documentation** (GTP-SDK, architecture docs)
4. **Add CI/CD pipeline** for automated builds and tests
5. **Create example apps** demonstrating each module

---

## Support and Resources

### H.U.G.H. Specific
- [Grizzly Translation Protocol (GTP-SDK)](./Grizzly%20Translation%20Protocol%20(GTP%E2%80%91SDK).md)
- [H.U.G.H. Architecture Documentation](./hugh_distributed_architecture.pdf)

### Apple Developer
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [WWDC Videos](https://developer.apple.com/videos/)
- [Developer Forums](https://developer.apple.com/forums/)

### Community
- [Swift Forums](https://forums.swift.org/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/swift)

---

**Version:** 1.0  
**Last Updated:** December 2025
