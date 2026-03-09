import Foundation
import AVFoundation
import Combine

public enum VoiceError: Error {
    case invalidURL
    case networkError(Error)
    case invalidResponse
    case decodingError
    case playbackError
}

public final class HughVoice: ObservableObject {
    private let apiKey: String
    private let voiceId: String
    private var audioPlayer: AVAudioPlayer?
    private let session = URLSession.shared
    
    @Published public var isSpeaking = false
    
    public init(apiKey: String, voiceId: String = "vibe-voice-scottish-male") {
        self.apiKey = apiKey
        self.voiceId = voiceId
    }
    
    public func speak(_ text: String) async throws {
        DispatchQueue.main.async {
            self.isSpeaking = true
        }
        
        defer {
            DispatchQueue.main.async {
                self.isSpeaking = false
            }
        }
        
        let audioData = try await generateAudio(text: text)
        try playAudio(data: audioData)
    }
    
    private func generateAudio(text: String) async throws -> Data {
        // Neets.ai / VibeVoice API Endpoint
        // Assuming OpenAI-compatible or standard REST structure
        guard let url = URL(string: "https://api.neets.ai/v1/tts") else {
            throw VoiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "text": text,
            "voice_id": voiceId,
            "params": [
                "model": "aragon" // Using the 'aragon' class mentioned in soul anchor
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw VoiceError.invalidResponse
        }
        
        return data
    }
    
    private func playAudio(data: Data) throws {
        do {
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.prepareToPlay()
            audioPlayer?.play()
            
            // Wait for playback to finish (simplified)
            while audioPlayer?.isPlaying == true {
                try await Task.sleep(nanoseconds: 100_000_000)
            }
        } catch {
            throw VoiceError.playbackError
        }
    }
}
