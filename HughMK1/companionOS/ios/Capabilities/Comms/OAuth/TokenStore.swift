import Foundation

struct OAuthToken: Codable {
  let accessToken: String
  let refreshToken: String?
  let expiry: Date?
}

enum TokenStore {
  static func save(_ token: OAuthToken, provider: String) {
    do {
      let data = try JSONEncoder().encode(token)
      Keychain.set(data, key: "cos.token.\(provider)")
    } catch {
      #if DEBUG
      print("Failed to save token", error)
      #endif
    }
  }

  static func load(provider: String) -> OAuthToken? {
    guard let data = Keychain.get("cos.token.\(provider)") else { return nil }
    return try? JSONDecoder().decode(OAuthToken.self, from: data)
  }

  static func setAPIKey(_ key: String, provider: String) {
    Keychain.setString(key, key: "cos.apikey.\(provider)")
  }

  static func getAPIKey(provider: String) -> String? {
    Keychain.getString("cos.apikey.\(provider)")
  }
}
