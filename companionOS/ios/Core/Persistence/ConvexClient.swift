import Foundation

final class ConvexClient {
  static let shared = ConvexClient()

  private let baseURL: URL?
  private let authToken: String

  private init() {
    baseURL = URL(string: Constants.convexURL)
    authToken = Constants.convexAuth
  }

  func call<T: Decodable>(_ path: String, _ body: [String: Any]) async throws -> T {
    guard let baseURL else {
      throw NSError(domain: "convex", code: -1, userInfo: [NSLocalizedDescriptionKey: "Missing CONVEX_DEPLOYMENT_URL"])
    }

    let url = baseURL.appendingPathComponent(path)
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")
    if !authToken.isEmpty {
      request.addValue(authToken, forHTTPHeaderField: "Authorization")
    }
    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (data, response) = try await URLSession.shared.data(for: request)
    if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
      let message = String(data: data, encoding: .utf8) ?? "Unknown Convex error"
      throw NSError(domain: "convex", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
    }

    return try JSONDecoder().decode(T.self, from: data)
  }
}
