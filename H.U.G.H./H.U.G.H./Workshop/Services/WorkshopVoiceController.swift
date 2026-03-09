//
//  WorkshopVoiceController.swift
//  H.U.G.H. – Workshop Layer
//
//  Wraps SFSpeechRecognizer to capture voice commands and parse them
//  into typed `WorkshopVoiceCommand` values for the Workshop scene.
//

import Foundation
import Speech
import AVFoundation
import Combine

// MARK: - Command model

/// A structured Workshop voice command parsed from raw speech.
enum WorkshopVoiceCommand {
    /// Spawn a new entity of the given type with a generated label.
    case spawn(type: String, label: String)
    /// Remove the entity whose label matches `label`.
    case delete(label: String)
    /// Recolour a named entity.
    case changeColor(entityLabel: String, color: String)
    /// Ask H.U.G.H. for a server/health status summary.
    case requestStatus
    /// Transcript that did not match any known pattern.
    case unknown(raw: String)
}

// MARK: - Controller

/// Manages microphone capture, live speech recognition, and command parsing.
///
/// Usage:
/// ```swift
/// let vc = WorkshopVoiceController()
/// vc.startListening()
/// // observe vc.lastCommand via Combine or .onChange
/// vc.stopListening()
/// ```
@MainActor
final class WorkshopVoiceController: ObservableObject {

    // MARK: Published state

    /// `true` while the audio engine and recognition task are active.
    @Published var isListening: Bool = false
    /// Live rolling transcription from the current recognition session.
    @Published var transcription: String = ""
    /// The most recently parsed command (nil until the first successful parse).
    @Published var lastCommand: WorkshopVoiceCommand?

    // MARK: Private

    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var audioEngine: AVAudioEngine?

    // MARK: Init

    init() {
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    }

    // MARK: - Public API

    /// Requests speech recognition permission if needed, then starts listening.
    func startListening() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            guard let self, status == .authorized else { return }
            Task { @MainActor in
                do {
                    try self.beginRecognitionSession()
                } catch {
                    self.isListening = false
                }
            }
        }
    }

    /// Stops microphone capture and finalises the current recognition task.
    func stopListening() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()

        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
    }

    /// Parses a raw transcription string into a `WorkshopVoiceCommand`.
    ///
    /// Recognised patterns (case-insensitive):
    /// - "create/spawn/add a \<type\>" → `.spawn`
    /// - "remove/delete (the) \<label\>" → `.delete`
    /// - "change (the) \<label\> color to \<color\>" → `.changeColor`
    /// - "show status" / "server status" → `.requestStatus`
    func parseCommand(_ text: String) -> WorkshopVoiceCommand? {
        let lower = text.lowercased().trimmingCharacters(in: .whitespaces)

        // Spawn / create
        if let match = lower.firstMatch(pattern: #"(?:create|spawn|add)\s+a\s+(\w+)"#),
           let typeRange = match.range(at: 1, in: lower) {
            let type = String(lower[typeRange])
            let label = "\(type.capitalized)-\(shortID())"
            return .spawn(type: type, label: label)
        }

        // Delete / remove
        if let match = lower.firstMatch(pattern: #"(?:remove|delete)\s+(?:the\s+)?(.+)"#),
           let labelRange = match.range(at: 1, in: lower) {
            return .delete(label: String(lower[labelRange]).trimmingCharacters(in: .whitespaces))
        }

        // Change colour
        if let match = lower.firstMatch(
            pattern: #"change\s+(?:the\s+)?(.+?)\s+colou?r\s+to\s+(\w+)"#
        ),
           let entityRange = match.range(at: 1, in: lower),
           let colorRange  = match.range(at: 2, in: lower) {
            return .changeColor(
                entityLabel: String(lower[entityRange]),
                color: String(lower[colorRange])
            )
        }

        // Status
        if lower.contains("show status") || lower.contains("server status") {
            return .requestStatus
        }

        return .unknown(raw: text)
    }

    // MARK: - Private helpers

    private func beginRecognitionSession() throws {
        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true

        guard let recognizer = speechRecognizer, recognizer.isAvailable else { return }

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                self.transcription = text
                if result.isFinal, let command = self.parseCommand(text) {
                    self.lastCommand = command
                }
            }
            if error != nil || result?.isFinal == true {
                self.stopListening()
            }
        }

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        engine.prepare()
        try engine.start()

        audioEngine = engine
        recognitionRequest = request
        isListening = true
    }

    /// Returns a short 4-character hex suffix for auto-generated labels.
    private func shortID() -> String {
        String(UUID().uuidString.prefix(4).lowercased())
    }
}

// MARK: - String regex helper

private extension String {
    func firstMatch(pattern: String) -> NSTextCheckingResult? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return nil
        }
        return regex.firstMatch(in: self, range: NSRange(startIndex..., in: self))
    }
}

private extension NSTextCheckingResult {
    func range(at idx: Int, in string: String) -> Range<String.Index>? {
        Range(range(at: idx), in: string)
    }
}
