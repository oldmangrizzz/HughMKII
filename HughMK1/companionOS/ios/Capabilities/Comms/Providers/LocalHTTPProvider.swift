import Foundation

final class LocalHTTPProvider: LLMProvider {
  let id = "localHTTP"

  func chat(_ request: ChatRequest, token: String?) async throws -> ChatResponse {
    guard let base = URL(string: Constants.localBaseURL) else {
      throw NSError(domain: "localHTTP", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid LOCAL_LLM_BASE_URL"])
    }

    var urlRequest = URLRequest(url: base.appendingPathComponent("chat"))
    urlRequest.httpMethod = "POST"
    urlRequest.addValue("application/json", forHTTPHeaderField: "Content-Type")
    if let bearer = Constants.localBearer, !bearer.isEmpty {
      urlRequest.addValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    }

    urlRequest.httpBody = try JSONEncoder().encode(request)

    let (data, _) = try await URLSession.shared.data(for: urlRequest)
    return try JSONDecoder().decode(ChatResponse.self, from: data)
  }
}
