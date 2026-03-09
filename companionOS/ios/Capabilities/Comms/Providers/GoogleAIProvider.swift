import Foundation

final class GoogleAIProvider: LLMProvider {
  let id = "gemini"

  func chat(_ request: ChatRequest, token: String?) async throws -> ChatResponse {
    guard let token else {
      throw NSError(domain: "gemini", code: 401, userInfo: [NSLocalizedDescriptionKey: "Missing OAuth token"])
    }

    var urlRequest = URLRequest(url: URL(string: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent")!)
    urlRequest.httpMethod = "POST"
    urlRequest.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    urlRequest.addValue("application/json", forHTTPHeaderField: "Content-Type")

    let payload: [String: Any] = [
      "contents": [
        [
          "parts": [
            ["text": request.text],
          ],
        ],
      ],
    ]

    urlRequest.httpBody = try JSONSerialization.data(withJSONObject: payload)

    let (data, _) = try await URLSession.shared.data(for: urlRequest)

    struct Response: Decodable {
      struct Candidate: Decodable {
        struct Content: Decodable {
          struct Part: Decodable {
            let text: String?
          }
          let parts: [Part]
        }
        let content: Content
      }
      let candidates: [Candidate]
    }

    if let decoded = try? JSONDecoder().decode(Response.self, from: data) {
      let text = decoded.candidates.first?.content.parts.compactMap { $0.text }.joined(separator: " ") ?? ""
      return ChatResponse(text: text)
    }

    if let raw = String(data: data, encoding: .utf8) {
      throw NSError(domain: "gemini", code: 500, userInfo: [NSLocalizedDescriptionKey: raw])
    }
    throw NSError(domain: "gemini", code: 500, userInfo: [NSLocalizedDescriptionKey: "Unknown Gemini response"])
  }
}
