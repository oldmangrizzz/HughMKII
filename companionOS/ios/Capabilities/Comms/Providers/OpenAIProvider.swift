import Foundation

final class OpenAIProvider: LLMProvider {
  let id = "openai"

  func chat(_ request: ChatRequest, token: String?) async throws -> ChatResponse {
    let key = token ?? TokenStore.getAPIKey(provider: id)
    guard let key else {
      throw NSError(domain: "openai", code: 401, userInfo: [NSLocalizedDescriptionKey: "Missing OpenAI credential"])
    }

    var urlRequest = URLRequest(url: URL(string: "https://api.openai.com/v1/chat/completions")!)
    urlRequest.httpMethod = "POST"
    urlRequest.addValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
    urlRequest.addValue("application/json", forHTTPHeaderField: "Content-Type")

    let payload: [String: Any] = [
      "model": "gpt-4o-mini",
      "messages": [
        [
          "role": "user",
          "content": request.text,
        ],
      ],
    ]

    urlRequest.httpBody = try JSONSerialization.data(withJSONObject: payload)

    let (data, _) = try await URLSession.shared.data(for: urlRequest)
    struct Response: Decodable {
      struct Choice: Decodable {
        struct Message: Decodable {
          let content: String
        }
        let message: Message
      }
      let choices: [Choice]
    }

    if let decoded = try? JSONDecoder().decode(Response.self, from: data) {
      let text = decoded.choices.first?.message.content ?? ""
      return ChatResponse(text: text)
    }

    if let raw = String(data: data, encoding: .utf8) {
      throw NSError(domain: "openai", code: 500, userInfo: [NSLocalizedDescriptionKey: raw])
    }
    throw NSError(domain: "openai", code: 500, userInfo: [NSLocalizedDescriptionKey: "Unknown OpenAI response"])
  }
}
