# H.U.G.H. — Xcode Setup Guide

## Overview

All Swift files have been created and are ready to add to Xcode. The project is structured so the main multiplatform target shares core files while platform-specific targets get their own source trees.

---

## New Files Created

### Core (all targets that apply)

| File | Purpose |
|------|---------|
| `H.U.G.H./Core/HUGHClient.swift` | Sovereign service layer — H.U.G.H. API, Home Assistant, Convex, LFM |
| `H.U.G.H./Core/AnyCodable.swift` | Type-erased Codable wrapper for HA attributes & Convex args |
| `H.U.G.H./Core/SpeechRecognizer.swift` | Speech framework + AVAudioEngine real-time transcription |
| `H.U.G.H./ContentView.swift` | **Replaced** — E-Scape philosophy UI (ambient void + voice portal) |

### tvOS Target (`tvOS/`)

| File | Purpose |
|------|---------|
| `tvOS/HughTVApp.swift` | `@main` entry point for tvOS |
| `tvOS/HughAmbientView.swift` | Full-screen ambient intelligence display |
| `tvOS/HAEntityRow.swift` | HA entity state badge (compact + expanded) |
| `tvOS/WorkshopLiveFeed.swift` | WKWebView of workshop.grizzlymedicine.icu |

### watchOS Target (`watchOS/`)

| File | Purpose |
|------|---------|
| `watchOS/HughWatchApp.swift` | `@main` + WKApplicationDelegate for watchOS |
| `watchOS/HughWatchView.swift` | Primary watch face + `WatchHUGHClient` |
| `watchOS/HughComplication.swift` | CLKComplication data source (6 families) |
| `watchOS/QuickActionButton.swift` | Tappable quick-action button with haptic feedback |

### macOS Target (`macOS/`)

| File | Purpose |
|------|---------|
| `macOS/HughMenuBarApp.swift` | `NSStatusItem` menu bar + popover |
| `macOS/HughMainWindow.swift` | Full E-Scape window, command palette (Cmd+K), Workshop WebView |

### Updated

| File | Change |
|------|--------|
| `companionOS/ios/Core/Support/Constants.swift` | All real endpoints wired (Convex, H.U.G.H., HA, LFM) |

---

## Adding Files to Xcode Targets

### Step 1: Open the project
```
open ~/hughmkii/H.U.G.H./H.U.G.H..xcodeproj
```

### Step 2: Add Core files to existing multiplatform target

Drag these files into Xcode's navigator under `H.U.G.H./` group, adding to **all applicable targets**:

```
H.U.G.H./Core/HUGHClient.swift          → H.U.G.H. (iOS, macOS, visionOS)
H.U.G.H./Core/AnyCodable.swift          → H.U.G.H. (iOS, macOS, visionOS)
H.U.G.H./Core/SpeechRecognizer.swift    → H.U.G.H. (iOS, macOS, visionOS)
```

### Step 3: Add tvOS target

1. **File → New → Target → tvOS → App**
   - Product Name: `H.U.G.H. TV`
   - Bundle ID: `com.grizzlymedicine.hugh.tv`
   - Minimum Deployment: tvOS 17.0

2. Drag into the new target's group:
   ```
   tvOS/HughTVApp.swift
   tvOS/HughAmbientView.swift
   tvOS/HAEntityRow.swift
   tvOS/WorkshopLiveFeed.swift
   H.U.G.H./Core/HUGHClient.swift       (also add to tvOS target membership)
   H.U.G.H./Core/AnyCodable.swift       (also add to tvOS target membership)
   ```

3. In **tvOS target → Build Phases → Compile Sources**, ensure `WorkshopConvexService.swift` is NOT included (tvOS doesn't need it; `HUGHClient.swift` covers Convex access).

> ⚠️ `HughAmbientView.swift` has a `Color(hex:)` extension — if building multiplatform and ContentView.swift's extension is in scope, remove the duplicate from `HughAmbientView.swift` (marked with a comment).

### Step 4: Add watchOS target

1. **File → New → Target → watchOS → Watch App**
   - Product Name: `H.U.G.H. Watch`
   - Bundle ID: `com.grizzlymedicine.hugh.watch`
   - Minimum Deployment: watchOS 10.0

2. Drag into the Watch App target:
   ```
   watchOS/HughWatchApp.swift
   watchOS/HughWatchView.swift
   watchOS/HughComplication.swift
   watchOS/QuickActionButton.swift
   ```

3. Note: `HughComplication.swift` uses `ClockKit` — ensure **ClockKit.framework** is linked.

4. `WatchHUGHClient` in `HughWatchView.swift` uses direct URLSession. For production, bridge through `WatchSession.swift` from `companionOS/watch/` for iPhone relay.

### Step 5: macOS integration

The existing multiplatform target already supports macOS. Add:

```
macOS/HughMenuBarApp.swift   → H.U.G.H. target (macOS only via #if os(macOS))
macOS/HughMainWindow.swift   → H.U.G.H. target (macOS only via #if os(macOS))
```

For the menu bar to appear, update `H_U_G_H_App.swift` on macOS:

```swift
#if os(macOS)
// In your App body, add:
// Settings { ... }
// And init HughMenuBarController in init()
#endif
```

---

## Capabilities to Enable in Signing & Capabilities

### All targets
- **App Sandbox** (macOS): Network → Outbound Connections (Client), Hardware → Microphone

### iOS / macOS / visionOS target
- **Microphone** (via entitlement + Info.plist key already added)
- **Speech Recognition** (Info.plist key already added)
- **HomeKit** (if using HomeKitManager.swift)
- **Push Notifications** (for HA webhook triggers)
- **Background Modes**: Background fetch, Remote notifications

### watchOS target  
- **HealthKit** (optional, for future biometric integration)
- **Complications** (automatic with WatchKit target)

---

## Info.plist Keys to Add

See `H.U.G.H./ATS_InfoPlist_Additions.xml` for the full XML block to paste.

**Summary of required keys:**

| Key | Value |
|-----|-------|
| `NSMicrophoneUsageDescription` | "H.U.G.H. uses voice as the primary interaction modality" |
| `NSSpeechRecognitionUsageDescription` | "Voice commands are transcribed to communicate with H.U.G.H." |
| `NSLocalNetworkUsageDescription` | "H.U.G.H. connects to Home Assistant on your local network" |
| `NSBonjourServices` | `["_hap._tcp", "_homekit._tcp"]` |
| `NSAppTransportSecurity` → `NSExceptionDomains` | See XML file — exceptions for `192.168.7.194` and `187.124.28.147` |

---

## Swift Package to Add

In Xcode: **File → Add Package Dependencies**

```
URL:     https://github.com/get-convex/convex-swift
Version: from 0.4.0
```

Add to: all targets that use Convex (primary H.U.G.H. target, tvOS target).

Once added, update `HUGHClient.swift` and `WorkshopConvexService.swift`:
- Replace raw URLSession Convex calls with `ConvexClient` from the SDK
- See `// MARK: - Upgrade to ConvexMobile SDK` comments in both files

---

## Real Endpoints Wired

| Service | URL |
|---------|-----|
| H.U.G.H. API | `https://api.grizzlymedicine.icu` |
| H.U.G.H. Health | `https://api.grizzlymedicine.icu/health` |
| Convex (prod) | `https://sincere-albatross-464.convex.cloud` |
| Home Assistant | `http://192.168.7.194:8123` |
| LFM (proxied) | `https://api.grizzlymedicine.icu/v1/chat/completions` |
| LFM (direct) | `http://187.124.28.147:8080/v1/chat/completions` |
| Workshop | `https://workshop.grizzlymedicine.icu` |

> ⚠️ **Security**: `haToken` in `HUGHClient.swift` is hardcoded for development.  
> Before App Store submission: migrate to Keychain using `Keychain.swift` in `companionOS/ios/Core/Support/`.

---

## Architecture Notes

```
Sovereign Environment (single shared intelligence space)
├── iOS App      → ContentView.swift (E-Scape, voice-first)
├── macOS App    → HughMainWindow.swift (E-Scape desktop, Cmd+K palette)
│                  HughMenuBarApp.swift (always-present status item)
├── tvOS App     → HughAmbientView.swift (passive intelligence display)
├── watchOS App  → HughWatchView.swift (wrist presence + quick actions)
└── visionOS App → WorkshopRealityView.swift (immersive space, auto-opens)

All platforms share:
├── HUGHClient.swift   (service layer, @MainActor singleton)
├── AnyCodable.swift   (JSON bridge)
└── SpeechRecognizer.swift (iOS/macOS/visionOS only)
```

The apps are not separate applications — they are the same sovereign environment wearing different form factors.
