# Apple SDK Tools and Commands Reference
# Command-Line Interface Quick Reference

**Purpose:** Quick reference for Apple SDK command-line tools and utilities  
**Date:** December 2025

---

## Table of Contents
1. [Xcode Command Line Tools](#xcode-command-line-tools)
2. [Swift Tools](#swift-tools)
3. [Build and Archive](#build-and-archive)
4. [Simulator Management](#simulator-management)
5. [Code Signing and Notarization](#code-signing-and-notarization)
6. [Testing and Debugging](#testing-and-debugging)
7. [Distribution and Deployment](#distribution-and-deployment)
8. [Useful Scripts](#useful-scripts)

---

## Xcode Command Line Tools

### xcode-select
Manage active Xcode installation

```bash
# Install Command Line Tools
xcode-select --install

# Show current Xcode path
xcode-select --print-path

# Switch to different Xcode version
sudo xcode-select --switch /Applications/Xcode.app

# Reset to default
sudo xcode-select --reset

# Show Xcode version
xcodebuild -version

# Show SDK versions
xcodebuild -showsdks
```

### xcrun
Run or locate development tools

```bash
# Find tool path
xcrun --find clang
xcrun --find swift
xcrun --find lldb

# Show SDK path
xcrun --show-sdk-path
xcrun --show-sdk-platform-path

# Run tool with SDK
xcrun --sdk macosx swift --version
xcrun --sdk iphoneos clang --version

# List simulators
xcrun simctl list

# Notarize app
xcrun notarytool submit app.zip --keychain-profile "AC_PASSWORD"
```

---

## Swift Tools

### Swift Package Manager (SPM)

```bash
# Initialize new package
swift package init --type library
swift package init --type executable
swift package init --type tool

# Build package
swift build
swift build -c release  # Release build
swift build -v          # Verbose output

# Run executable
swift run
swift run MyExecutable --arg1 value1

# Test package
swift test
swift test --filter MyTestCase
swift test --enable-code-coverage

# Update dependencies
swift package update

# Resolve dependencies
swift package resolve

# Show dependencies
swift package show-dependencies

# Generate Xcode project (deprecated, but still works)
swift package generate-xcodeproj

# Clean build artifacts
swift package clean

# Describe package
swift package describe
swift package describe --type json

# Archive for distribution
swift build -c release --arch arm64 --arch x86_64

# Dump package configuration
swift package dump-package
```

### Swift Compiler

```bash
# Compile Swift file
swiftc main.swift -o myapp

# Compile with optimization
swiftc -O main.swift -o myapp

# Compile for specific target
swiftc -target arm64-apple-macos13.0 main.swift

# Show target info
swiftc -print-target-info

# Generate Interface
swiftc -emit-module MyModule.swift

# Check syntax only
swiftc -parse main.swift

# Type checking only
swiftc -typecheck main.swift
```

### Swift REPL and LLDB

```bash
# Start Swift REPL
swift

# Run Swift script
swift myscript.swift

# Debug with LLDB
lldb myapp

# Common LLDB commands
# (lldb) run
# (lldb) breakpoint set --name main
# (lldb) continue
# (lldb) print variable
# (lldb) step
# (lldb) next
# (lldb) quit
```

---

## Build and Archive

### xcodebuild

```bash
# Build project
xcodebuild -project MyApp.xcodeproj \
  -scheme MyScheme \
  -configuration Release \
  build

# Build workspace
xcodebuild -workspace MyApp.xcworkspace \
  -scheme MyScheme \
  build

# Build for simulator
xcodebuild -project MyApp.xcodeproj \
  -scheme MyScheme \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  build

# Build for device
xcodebuild -project MyApp.xcodeproj \
  -scheme MyScheme \
  -destination 'platform=iOS,name=My iPhone' \
  build

# Clean build
xcodebuild clean \
  -project MyApp.xcodeproj \
  -scheme MyScheme

# Archive for distribution
xcodebuild archive \
  -workspace MyApp.xcworkspace \
  -scheme MyScheme \
  -archivePath ./build/MyApp.xcarchive

# Export archive (IPA)
xcodebuild -exportArchive \
  -archivePath ./build/MyApp.xcarchive \
  -exportPath ./build \
  -exportOptionsPlist exportOptions.plist

# Show schemes
xcodebuild -list -project MyApp.xcodeproj
xcodebuild -list -workspace MyApp.xcworkspace

# Show build settings
xcodebuild -showBuildSettings \
  -project MyApp.xcodeproj \
  -scheme MyScheme

# Test
xcodebuild test \
  -workspace MyApp.xcworkspace \
  -scheme MyScheme \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro'

# Test without building
xcodebuild test-without-building \
  -workspace MyApp.xcworkspace \
  -scheme MyScheme

# Code coverage
xcodebuild test \
  -workspace MyApp.xcworkspace \
  -scheme MyScheme \
  -enableCodeCoverage YES \
  -resultBundlePath ./TestResults.xcresult
```

### exportOptions.plist Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <!-- Options: app-store, ad-hoc, enterprise, development, developer-id -->
    
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    
    <key>uploadBitcode</key>
    <false/>
    
    <key>uploadSymbols</key>
    <true/>
    
    <key>compileBitcode</key>
    <false/>
    
    <key>signingStyle</key>
    <string>automatic</string>
    <!-- Options: automatic, manual -->
    
    <key>signingCertificate</key>
    <string>Apple Distribution</string>
    
    <key>provisioningProfiles</key>
    <dict>
        <key>com.example.myapp</key>
        <string>MyApp Distribution Profile</string>
    </dict>
</dict>
</plist>
```

---

## Simulator Management

### simctl

```bash
# List all simulators
xcrun simctl list

# List devices only
xcrun simctl list devices

# List runtimes
xcrun simctl list runtimes

# Create new simulator
xcrun simctl create "iPhone 15 Pro" \
  "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro" \
  "com.apple.CoreSimulator.SimRuntime.iOS-17-0"

# Boot simulator
xcrun simctl boot "iPhone 15 Pro"

# Shutdown simulator
xcrun simctl shutdown "iPhone 15 Pro"

# Shutdown all simulators
xcrun simctl shutdown all

# Delete simulator
xcrun simctl delete "iPhone 15 Pro"

# Delete unavailable simulators
xcrun simctl delete unavailable

# Erase simulator content
xcrun simctl erase "iPhone 15 Pro"
xcrun simctl erase all

# Install app
xcrun simctl install "iPhone 15 Pro" path/to/MyApp.app

# Uninstall app
xcrun simctl uninstall "iPhone 15 Pro" com.example.myapp

# Launch app
xcrun simctl launch "iPhone 15 Pro" com.example.myapp

# Terminate app
xcrun simctl terminate "iPhone 15 Pro" com.example.myapp

# Open URL
xcrun simctl openurl "iPhone 15 Pro" "https://example.com"

# Take screenshot
xcrun simctl io "iPhone 15 Pro" screenshot screenshot.png

# Record video
xcrun simctl io "iPhone 15 Pro" recordVideo video.mov

# Get app container path
xcrun simctl get_app_container "iPhone 15 Pro" com.example.myapp

# Push notification (iOS 13+)
xcrun simctl push "iPhone 15 Pro" com.example.myapp payload.json

# Set location
xcrun simctl location "iPhone 15 Pro" set 37.7749,-122.4194

# Privacy permissions
xcrun simctl privacy "iPhone 15 Pro" grant location com.example.myapp
xcrun simctl privacy "iPhone 15 Pro" grant photos com.example.myapp
xcrun simctl privacy "iPhone 15 Pro" grant camera com.example.myapp
xcrun simctl privacy "iPhone 15 Pro" grant microphone com.example.myapp

# Status bar overrides
xcrun simctl status_bar "iPhone 15 Pro" override \
  --time "9:41" \
  --dataNetwork "wifi" \
  --wifiMode "active" \
  --wifiBars "3" \
  --cellularMode "active" \
  --cellularBars "4" \
  --batteryState "charged" \
  --batteryLevel "100"

# Clear status bar overrides
xcrun simctl status_bar "iPhone 15 Pro" clear
```

### Push Notification Payload (payload.json)

```json
{
  "aps": {
    "alert": {
      "title": "H.U.G.H. Alert",
      "body": "This is a test notification"
    },
    "badge": 1,
    "sound": "default"
  },
  "customData": {
    "key": "value"
  }
}
```

---

## Code Signing and Notarization

### security (Keychain)

```bash
# List keychains
security list-keychains

# Show default keychain
security default-keychain

# Unlock keychain (for CI)
security unlock-keychain -p password ~/Library/Keychains/login.keychain-db

# Find identity
security find-identity -v -p codesigning

# Import certificate
security import certificate.p12 -k ~/Library/Keychains/login.keychain-db -P password -T /usr/bin/codesign

# Add to keychain access control
security set-key-partition-list -S apple-tool:,apple: -s -k password ~/Library/Keychains/login.keychain-db

# Create keychain (for CI)
security create-keychain -p password build.keychain
security default-keychain -s build.keychain
security unlock-keychain -p password build.keychain
security set-keychain-settings -t 3600 -u build.keychain
```

### codesign

```bash
# Sign app
codesign --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --timestamp \
  --options runtime \
  MyApp.app

# Sign with entitlements
codesign --sign "Developer ID Application: Your Name" \
  --entitlements entitlements.plist \
  --timestamp \
  --options runtime \
  MyApp.app

# Verify signature
codesign --verify --verbose MyApp.app

# Display signing info
codesign --display --verbose=4 MyApp.app

# Deep verify (check all nested code)
codesign --verify --deep --strict --verbose=2 MyApp.app

# Sign framework
codesign --sign "Developer ID Application: Your Name" \
  --timestamp \
  MyFramework.framework

# Remove signature
codesign --remove-signature MyApp.app
```

### notarytool

```bash
# Store credentials in keychain
xcrun notarytool store-credentials "AC_PASSWORD" \
  --apple-id "email@example.com" \
  --team-id "TEAM_ID" \
  --password "xxxx-xxxx-xxxx-xxxx"

# Submit for notarization
xcrun notarytool submit MyApp.zip \
  --keychain-profile "AC_PASSWORD" \
  --wait

# Check notarization status
xcrun notarytool info SUBMISSION_ID \
  --keychain-profile "AC_PASSWORD"

# Get notarization log
xcrun notarytool log SUBMISSION_ID \
  --keychain-profile "AC_PASSWORD" \
  notarization.log

# List submissions
xcrun notarytool history \
  --keychain-profile "AC_PASSWORD"

# Staple ticket to app
xcrun stapler staple MyApp.app

# Verify stapling
xcrun stapler validate MyApp.app

# Staple to DMG
xcrun stapler staple MyApp.dmg
```

---

## Testing and Debugging

### Testing Commands

```bash
# Run all tests
swift test

# Run specific test
swift test --filter HUGHCoreTests

# Run with code coverage
swift test --enable-code-coverage

# Parallel testing
swift test --parallel

# Generate test report
xcodebuild test \
  -workspace MyApp.xcworkspace \
  -scheme MyScheme \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  -resultBundlePath TestResults.xcresult

# View test results
xcrun xcresulttool get --path TestResults.xcresult

# Export test results
xcrun xcresulttool export --type directory \
  --path TestResults.xcresult \
  --output-path ./test-results
```

### Instruments

```bash
# List available instruments
xcrun instruments -s

# Profile app
xcrun instruments -t "Time Profiler" MyApp.app

# Profile with specific template
xcrun instruments -t "Allocations" -D trace.trace MyApp.app

# Available templates:
# - Activity Monitor
# - Allocations
# - Leaks
# - Time Profiler
# - System Trace
# - Network
# - Energy Log
```

### lldb Debugging

```bash
# Attach to running process
lldb -p PID

# Debug executable
lldb MyApp.app

# Common commands:
# (lldb) breakpoint set --name main
# (lldb) breakpoint set --file main.swift --line 10
# (lldb) breakpoint list
# (lldb) run
# (lldb) continue
# (lldb) step
# (lldb) next
# (lldb) finish
# (lldb) print variableName
# (lldb) po object
# (lldb) frame variable
# (lldb) thread backtrace
# (lldb) thread list
# (lldb) quit
```

---

## Distribution and Deployment

### Create DMG

```bash
# Create DMG from app
hdiutil create -volname "H.U.G.H." \
  -srcfolder MyApp.app \
  -ov -format UDZO \
  MyApp.dmg

# Create DMG from folder with custom layout
hdiutil create -volname "H.U.G.H." \
  -srcfolder dist \
  -ov -format UDZO \
  MyApp.dmg

# Mount DMG
hdiutil attach MyApp.dmg

# Unmount DMG
hdiutil detach /Volumes/H.U.G.H.

# Convert DMG format
hdiutil convert input.dmg -format UDZO -o output.dmg
```

### Create PKG Installer

```bash
# Build component package
pkgbuild --root ./MyApp.app \
  --identifier com.example.myapp \
  --version 1.0 \
  --install-location /Applications \
  MyApp.pkg

# Build product archive (multiple components)
productbuild --distribution distribution.xml \
  --resources ./resources \
  MyApp.pkg

# Sign package
productsign --sign "Developer ID Installer: Your Name" \
  unsigned.pkg \
  signed.pkg
```

### App Store Connect API

```bash
# Upload build using altool (deprecated, use Xcode Transporter or App Store Connect)
xcrun altool --upload-app \
  --type ios \
  --file MyApp.ipa \
  --apiKey "API_KEY" \
  --apiIssuer "ISSUER_ID"

# Validate before upload
xcrun altool --validate-app \
  --type ios \
  --file MyApp.ipa \
  --apiKey "API_KEY" \
  --apiIssuer "ISSUER_ID"

# Note: Use App Store Connect API or Transporter app for new projects
# https://developer.apple.com/documentation/appstoreconnectapi
```

---

## Useful Scripts

### Build and Archive Script

```bash
#!/bin/bash
# build_and_archive.sh

set -e

WORKSPACE="MyApp.xcworkspace"
SCHEME="MyApp"
CONFIGURATION="Release"
ARCHIVE_PATH="./build/MyApp.xcarchive"
EXPORT_PATH="./build"

echo "Building and archiving..."

# Clean
xcodebuild clean \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION"

# Archive
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates

# Export
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist exportOptions.plist

echo "Build complete: $EXPORT_PATH/MyApp.ipa"
```

### Automated Testing Script

```bash
#!/bin/bash
# run_tests.sh

set -e

WORKSPACE="MyApp.xcworkspace"
SCHEME="MyApp"
DESTINATION="platform=iOS Simulator,name=iPhone 15 Pro"

echo "Running tests..."

# Run tests with coverage
xcodebuild test \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -destination "$DESTINATION" \
  -enableCodeCoverage YES \
  -resultBundlePath ./TestResults.xcresult \
  | xcpretty

# Export coverage
xcrun xccov view --report --json ./TestResults.xcresult > coverage.json

echo "Tests complete"
```

### Sign and Notarize Script

```bash
#!/bin/bash
# sign_and_notarize.sh

set -e

APP_PATH="./MyApp.app"
IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
ZIP_PATH="./MyApp.zip"
KEYCHAIN_PROFILE="AC_PASSWORD"

echo "Signing app..."

# Sign
codesign --sign "$IDENTITY" \
  --timestamp \
  --options runtime \
  --deep \
  --force \
  "$APP_PATH"

# Verify
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "Creating ZIP..."
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "Notarizing..."
xcrun notarytool submit "$ZIP_PATH" \
  --keychain-profile "$KEYCHAIN_PROFILE" \
  --wait

echo "Stapling..."
xcrun stapler staple "$APP_PATH"

echo "Verification..."
xcrun stapler validate "$APP_PATH"

echo "Done!"
```

### CI/CD GitHub Actions Example

```yaml
# .github/workflows/build.yml
name: Build and Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: macos-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Select Xcode
      run: sudo xcode-select -s /Applications/Xcode_15.0.app
    
    - name: Install dependencies
      run: swift package resolve
    
    - name: Build
      run: swift build -c release
    
    - name: Run tests
      run: swift test --enable-code-coverage
    
    - name: Generate coverage report
      run: |
        xcrun llvm-cov export -format="lcov" \
          .build/debug/HughMK1PackageTests.xctest/Contents/MacOS/HughMK1PackageTests \
          -instr-profile .build/debug/codecov/default.profdata > coverage.lcov
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage.lcov
```

---

## Environment Variables

```bash
# Xcode paths
export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
export PATH="$DEVELOPER_DIR/usr/bin:$PATH"

# Swift paths
export TOOLCHAINS=swift

# Build settings
export CONFIGURATION=Release
export ONLY_ACTIVE_ARCH=NO

# Code signing (for CI)
export CODE_SIGN_IDENTITY="Apple Distribution"
export DEVELOPMENT_TEAM="TEAM_ID"

# Disable code signing (for testing)
export CODE_SIGNING_REQUIRED=NO
export CODE_SIGNING_ALLOWED=NO
```

---

## Quick Reference

### Most Used Commands

```bash
# Development
xcode-select --install
swift package init
swift build
swift test
swift run

# Building
xcodebuild -workspace MyApp.xcworkspace -scheme MyScheme build
xcodebuild archive -workspace MyApp.xcworkspace -scheme MyScheme

# Testing
swift test --filter MyTest
xcodebuild test -workspace MyApp.xcworkspace -scheme MyScheme

# Simulator
xcrun simctl list devices
xcrun simctl boot "iPhone 15 Pro"
xcrun simctl install booted MyApp.app

# Signing
codesign --sign "Developer ID" --timestamp MyApp.app
xcrun notarytool submit MyApp.zip --keychain-profile "AC_PASSWORD"
xcrun stapler staple MyApp.app

# Distribution
hdiutil create -volname "MyApp" -srcfolder MyApp.app -format UDZO MyApp.dmg
pkgbuild --root MyApp.app --identifier com.example.myapp MyApp.pkg
```

---

**Version:** 1.0  
**Last Updated:** December 2025  
**For:** H.U.G.H. System Development
