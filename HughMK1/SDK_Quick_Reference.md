# H.U.G.H. SDK Quick Reference Card
# Essential Apple Frameworks for Voice Assistant Integration

**Purpose:** Quick reference for the most important SDKs needed for H.U.G.H. development  
**Date:** December 2025

---

## Core Voice Assistant SDKs

### 🎤 Speech Recognition
```swift
import Speech

// Request permission
SFSpeechRecognizer.requestAuthorization { status in
    // Handle authorization
}

// Create recognizer
let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

// Start recognition
let request = SFSpeechAudioBufferRecognitionRequest()
recognizer.recognitionTask(with: request) { result, error in
    if let result = result {
        print(result.bestTranscription.formattedString)
    }
}
```

**Privacy Key Required:** `NSSpeechRecognitionUsageDescription`

---

### 🔊 Text-to-Speech
```swift
import AVFoundation

let synthesizer = AVSpeechSynthesizer()
let utterance = AVSpeechUtterance(string: "Hello, I'm H.U.G.H.")
utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
utterance.rate = 0.5
synthesizer.speak(utterance)
```

---

### 🧠 Natural Language Processing
```swift
import NaturalLanguage

// Language detection
let recognizer = NLLanguageRecognizer()
recognizer.processString("Hello world")
let language = recognizer.dominantLanguage

// Sentiment analysis
let tagger = NLTagger(tagSchemes: [.sentimentScore])
tagger.string = "This is great!"
let sentiment = tagger.tag(at: text.startIndex, unit: .paragraph, scheme: .sentimentScore)

// Named entity recognition
let tagger = NLTagger(tagSchemes: [.nameType])
tagger.string = "John lives in San Francisco"
tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .nameType) { tag, range in
    print("\(text[range]): \(tag?.rawValue ?? "unknown")")
    return true
}
```

---

### 🎯 Siri Integration
```swift
import AppIntents

// iOS 16+ App Intent
struct ExecuteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Execute Task"
    
    @Parameter(title: "Task")
    var taskName: String
    
    func perform() async throws -> some IntentResult {
        // Execute the task
        return .result()
    }
}

// Shortcuts phrase
@available(iOS 16.0, macOS 13.0, *)
struct HUGHShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ExecuteTaskIntent(),
            phrases: [
                "Run \(\.$taskName) in H.U.G.H.",
                "Execute \(\.$taskName)"
            ]
        )
    }
}
```

**Privacy Key Required:** `NSSiriUsageDescription`

---

## System Integration SDKs

### 📍 Location Services
```swift
import CoreLocation

class LocationManager: NSObject, CLLocationManagerDelegate {
    let manager = CLLocationManager()
    
    func setup() {
        manager.delegate = self
        manager.requestAlwaysAuthorization()
        manager.startUpdatingLocation()
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let location = locations.last {
            print("Location: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        }
    }
}
```

**Privacy Keys Required:** `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`

---

### 🔔 User Notifications
```swift
import UserNotifications

// Request permission
let center = UNUserNotificationCenter.current()
center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
    print("Permission granted: \(granted)")
}

// Schedule notification
let content = UNMutableNotificationContent()
content.title = "H.U.G.H. Reminder"
content.body = "Don't forget about your meeting"
content.sound = .default

let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 60, repeats: false)
let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)

center.add(request) { error in
    if let error = error {
        print("Error: \(error)")
    }
}

// Critical alert (requires entitlement)
content.sound = .defaultCritical
content.interruptionLevel = .critical
```

---

### 📅 Calendar and Reminders
```swift
import EventKit

let eventStore = EKEventStore()

// Request calendar access
eventStore.requestAccess(to: .event) { granted, error in
    if granted {
        // Create event
        let event = EKEvent(eventStore: eventStore)
        event.title = "Meeting with Team"
        event.startDate = Date()
        event.endDate = Date().addingTimeInterval(3600)
        event.calendar = eventStore.defaultCalendarForNewEvents
        
        try? eventStore.save(event, span: .thisEvent)
    }
}

// Request reminders access
eventStore.requestAccess(to: .reminder) { granted, error in
    if granted {
        let reminder = EKReminder(eventStore: eventStore)
        reminder.title = "Call mom"
        reminder.calendar = eventStore.defaultCalendarForNewReminders()
        
        try? eventStore.save(reminder, commit: true)
    }
}
```

**Privacy Keys Required:** `NSCalendarsUsageDescription`, `NSRemindersUsageDescription`

---

### 👥 Contacts
```swift
import Contacts

let store = CNContactStore()

// Request access
store.requestAccess(for: .contacts) { granted, error in
    if granted {
        // Fetch contacts
        let keysToFetch = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactPhoneNumbersKey] as [CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keysToFetch)
        
        try? store.enumerateContacts(with: request) { contact, stop in
            print("\(contact.givenName) \(contact.familyName)")
        }
    }
}
```

**Privacy Key Required:** `NSContactsUsageDescription`

---

## AI/ML SDKs

### 🤖 Core ML
```swift
import CoreML
import Vision

// Load model
guard let model = try? VNCoreMLModel(for: YourMLModel().model) else {
    return
}

// Create request
let request = VNCoreMLRequest(model: model) { request, error in
    guard let results = request.results as? [VNClassificationObservation] else {
        return
    }
    
    for result in results {
        print("\(result.identifier): \(result.confidence)")
    }
}

// Perform inference
let handler = VNImageRequestHandler(cgImage: image, options: [:])
try? handler.perform([request])
```

---

### 👁️ Vision Framework
```swift
import Vision

// Face detection
let request = VNDetectFaceRectanglesRequest { request, error in
    guard let observations = request.results as? [VNFaceObservation] else {
        return
    }
    
    for face in observations {
        print("Face found at: \(face.boundingBox)")
    }
}

let handler = VNImageRequestHandler(cgImage: image, options: [:])
try? handler.perform([request])

// Text recognition (OCR)
let textRequest = VNRecognizeTextRequest { request, error in
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        return
    }
    
    for observation in observations {
        if let text = observation.topCandidates(1).first?.string {
            print("Text: \(text)")
        }
    }
}

textRequest.recognitionLevel = .accurate
try? handler.perform([textRequest])
```

---

## Smart Home & Health

### 🏠 HomeKit
```swift
import HomeKit

class HomeManager: NSObject, HMHomeManagerDelegate {
    let homeManager = HMHomeManager()
    
    override init() {
        super.init()
        homeManager.delegate = self
    }
    
    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        guard let home = manager.primaryHome else { return }
        
        // Control light
        for accessory in home.accessories {
            if let lightService = accessory.services.first(where: { $0.serviceType == HMServiceTypeLightbulb }) {
                if let powerChar = lightService.characteristics.first(where: { $0.characteristicType == HMCharacteristicTypePowerState }) {
                    powerChar.writeValue(true) { error in
                        print("Light turned on")
                    }
                }
            }
        }
    }
}
```

**Privacy Key Required:** `NSHomeKitUsageDescription`

---

### ❤️ HealthKit (iOS only)
```swift
import HealthKit

let healthStore = HKHealthStore()

// Request authorization
let typesToRead: Set = [
    HKObjectType.quantityType(forIdentifier: .heartRate)!,
    HKObjectType.quantityType(forIdentifier: .stepCount)!
]

healthStore.requestAuthorization(toShare: [], read: typesToRead) { success, error in
    if success {
        // Query heart rate
        guard let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate) else { return }
        
        let query = HKSampleQuery(sampleType: heartRateType, predicate: nil, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { query, samples, error in
            
            if let sample = samples?.first as? HKQuantitySample {
                let heartRate = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
                print("Heart rate: \(heartRate) BPM")
            }
        }
        
        healthStore.execute(query)
    }
}
```

**Privacy Keys Required:** `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`

---

## Cloud & Data

### ☁️ CloudKit
```swift
import CloudKit

let container = CKContainer.default()
let database = container.privateCloudDatabase

// Save record
let record = CKRecord(recordType: "UserPreference")
record["setting"] = "darkMode" as CKRecordValue
record["value"] = true as CKRecordValue

database.save(record) { record, error in
    if let error = error {
        print("Error: \(error)")
    } else {
        print("Saved successfully")
    }
}

// Query records
let query = CKQuery(recordType: "UserPreference", predicate: NSPredicate(value: true))
database.perform(query, inZoneWith: nil) { records, error in
    for record in records ?? [] {
        print("\(record["setting"] ?? ""): \(record["value"] ?? "")")
    }
}

// Modern async/await API
Task {
    let record = CKRecord(recordType: "Task")
    record["name"] = "My Task"
    try await database.save(record)
}
```

---

### 💾 Core Data
```swift
import CoreData

// Create container
let container = NSPersistentContainer(name: "HUGHModel")
container.loadPersistentStores { description, error in
    if let error = error {
        print("Error: \(error)")
    }
}

let context = container.viewContext

// Create entity
let task = NSEntityDescription.insertNewObject(forEntityName: "Task", into: context)
task.setValue("My Task", forKey: "name")
task.setValue(Date(), forKey: "createdAt")

// Save
try? context.save()

// Fetch
let fetchRequest = NSFetchRequest<NSManagedObject>(entityName: "Task")
let tasks = try? context.fetch(fetchRequest)
```

---

## Background Tasks

### ⏰ Background Tasks
```swift
import BackgroundTasks

// Register task
BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.hugh.refresh", using: nil) { task in
    handleAppRefresh(task: task as! BGAppRefreshTask)
}

// Schedule task
func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.hugh.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
    
    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        print("Could not schedule: \(error)")
    }
}

// Handle task
func handleAppRefresh(task: BGAppRefreshTask) {
    scheduleAppRefresh() // Schedule next run
    
    task.expirationHandler = {
        // Clean up
    }
    
    // Perform work
    performBackgroundWork { success in
        task.setTaskCompleted(success: success)
    }
}
```

**Required in Info.plist:**
```xml
<key>UIBackgroundModes</key>
<array>
    <string>processing</string>
    <string>fetch</string>
</array>
```

---

## Swift Concurrency

### async/await
```swift
// Define async function
func fetchData() async throws -> Data {
    let url = URL(string: "https://api.example.com/data")!
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}

// Call async function
Task {
    do {
        let data = try await fetchData()
        print("Received \(data.count) bytes")
    } catch {
        print("Error: \(error)")
    }
}

// Parallel tasks
async let data1 = fetchData()
async let data2 = fetchData()
let (result1, result2) = try await (data1, data2)
```

### Actors
```swift
actor DataCache {
    private var cache: [String: Data] = [:]
    
    func get(_ key: String) -> Data? {
        return cache[key]
    }
    
    func set(_ key: String, value: Data) {
        cache[key] = value
    }
}

// Usage
let cache = DataCache()
await cache.set("key", value: data)
let cachedData = await cache.get("key")
```

---

## Essential Info.plist Keys

```xml
<!-- Microphone -->
<key>NSMicrophoneUsageDescription</key>
<string>H.U.G.H. needs microphone access for voice commands</string>

<!-- Speech Recognition -->
<key>NSSpeechRecognitionUsageDescription</key>
<string>H.U.G.H. uses speech recognition to understand your voice</string>

<!-- Camera -->
<key>NSCameraUsageDescription</key>
<string>H.U.G.H. needs camera access for visual monitoring</string>

<!-- Location -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>H.U.G.H. uses your location for context-aware assistance</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>H.U.G.H. monitors your location for safety features</string>

<!-- Contacts -->
<key>NSContactsUsageDescription</key>
<string>H.U.G.H. accesses contacts for personalized assistance</string>

<!-- Calendar -->
<key>NSCalendarsUsageDescription</key>
<string>H.U.G.H. manages your calendar events</string>

<!-- Reminders -->
<key>NSRemindersUsageDescription</key>
<string>H.U.G.H. creates and manages reminders</string>

<!-- HomeKit -->
<key>NSHomeKitUsageDescription</key>
<string>H.U.G.H. controls your smart home devices</string>

<!-- Health -->
<key>NSHealthShareUsageDescription</key>
<string>H.U.G.H. monitors your health data</string>

<!-- Siri -->
<key>NSSiriUsageDescription</key>
<string>H.U.G.H. integrates with Siri</string>

<!-- Background Modes -->
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
    <string>location</string>
    <string>fetch</string>
    <string>processing</string>
</array>
```

---

## Quick Commands

```bash
# Build
swift build

# Run
swift run

# Test
swift test

# Build for device (iOS)
xcodebuild -workspace MyApp.xcworkspace \
  -scheme MyScheme \
  -destination 'platform=iOS,name=My iPhone' \
  build

# Launch simulator
xcrun simctl boot "iPhone 15 Pro"
open -a Simulator

# Install on simulator
xcrun simctl install booted MyApp.app

# View logs
xcrun simctl spawn booted log stream --predicate 'subsystem contains "com.example.hugh"'
```

---

## Common Patterns

### Singleton Manager
```swift
actor HUGHManager {
    static let shared = HUGHManager()
    
    private init() {}
    
    func process(command: String) async {
        // Process command
    }
}

// Usage
await HUGHManager.shared.process(command: "turn on lights")
```

### Combine Publishers
```swift
import Combine

class ViewModel: ObservableObject {
    @Published var text: String = ""
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        $text
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { value in
                print("Debounced: \(value)")
            }
            .store(in: &cancellables)
    }
}
```

### Error Handling
```swift
enum HUGHError: Error {
    case permissionDenied
    case networkError
    case invalidInput
}

func performAction() throws {
    guard hasPermission else {
        throw HUGHError.permissionDenied
    }
    
    // Perform action
}

// Usage
do {
    try performAction()
} catch HUGHError.permissionDenied {
    print("Permission denied")
} catch {
    print("Other error: \(error)")
}
```

---

**Pro Tip:** Always test permissions on a real device. Simulator may not accurately reflect permission states.

**Remember:** All privacy-sensitive APIs require Info.plist usage descriptions and runtime permission requests.

**For More:** See [Apple SDKs Catalog](./Apple_SDKs_Catalog.md) for complete documentation.

---

**Version:** 1.0  
**Last Updated:** December 2025  
**For:** H.U.G.H. System Development
