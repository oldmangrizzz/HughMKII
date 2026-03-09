// SpeechRecognizer.swift — H.U.G.H. Core
// Real-time speech transcription using Apple's Speech framework + AVAudioEngine.
// Used by VoicePortalView on iOS/macOS; watch uses WKExtendedRuntimeSession voice separately.

import Foundation
import Speech
import AVFoundation

#if !os(tvOS) && !os(watchOS)

@MainActor
final class SpeechRecognizer: ObservableObject {
    @Published var transcript: String = ""
    @Published var isRecording: Bool = false
    @Published var error: Error?

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private let audioEngine = AVAudioEngine()

    // MARK: - Authorization

    /// Requests microphone + speech recognition authorization.
    /// Returns true if both are granted.
    func requestAuthorization() async -> Bool {
        let speechAuth = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
        #if os(iOS)
        let micAuth = await AVAudioSession.sharedInstance().requestRecordPermission()
        return speechAuth && micAuth
        #else
        // macOS: AVCaptureDevice used for mic permission
        let micStatus = await AVCaptureDevice.requestAccess(for: .audio)
        return speechAuth && micStatus
        #endif
    }

    // MARK: - Recording lifecycle

    func startRecording() throws {
        guard !isRecording else { return }
        guard let recognizer = speechRecognizer, recognizer.isAvailable else {
            throw SpeechError.recognizerUnavailable
        }

        // Cancel any in-flight task
        recognitionTask?.cancel()
        recognitionTask = nil
        transcript = ""

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        recognitionRequest = request

        // Configure audio session (iOS only)
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        #endif

        // Install audio tap
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
        isRecording = true

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, err in
            guard let self else { return }
            if let result {
                Task { @MainActor in
                    self.transcript = result.bestTranscription.formattedString
                }
            }
            if err != nil || result?.isFinal == true {
                Task { @MainActor in
                    self.stopRecording()
                }
            }
        }
    }

    func stopRecording() {
        guard isRecording else { return }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.finish()
        recognitionTask = nil
        isRecording = false

        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}

enum SpeechError: LocalizedError {
    case recognizerUnavailable
    case microphoneDenied

    var errorDescription: String? {
        switch self {
        case .recognizerUnavailable: return "Speech recognizer is unavailable"
        case .microphoneDenied:      return "Microphone access denied"
        }
    }
}

#endif // !os(tvOS) && !os(watchOS)
