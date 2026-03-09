import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

final class OAuthService: NSObject {
  static let shared = OAuthService()

  private var session: ASWebAuthenticationSession?

  private override init() {
    super.init()
  }

  func signIn(config: ProviderConfig) async throws -> OAuthToken {
    guard
      config.usesOAuth,
      let auth = config.authEndpoint,
      let token = config.tokenEndpoint,
      let client = config.clientId,
      let redirect = config.redirectURI
    else {
      throw NSError(domain: "oauth", code: 0, userInfo: [NSLocalizedDescriptionKey: "Missing OAuth configuration"])
    }

    let (verifier, challenge) = pkce()
    let state = UUID().uuidString

    var components = URLComponents(url: auth, resolvingAgainstBaseURL: false)!
    components.queryItems = [
      URLQueryItem(name: "response_type", value: "code"),
      URLQueryItem(name: "client_id", value: client),
      URLQueryItem(name: "redirect_uri", value: redirect),
      URLQueryItem(name: "scope", value: config.scopes.joined(separator: " ")),
      URLQueryItem(name: "state", value: state),
      URLQueryItem(name: "code_challenge", value: challenge),
      URLQueryItem(name: "code_challenge_method", value: "S256"),
    ]

    let callbackURL = try await presentWebAuth(start: components.url!, scheme: URL(string: redirect)!.scheme!)
    guard let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
      throw NSError(domain: "oauth", code: 1, userInfo: [NSLocalizedDescriptionKey: "Authorization code missing"])
    }

    var request = URLRequest(url: token)
    request.httpMethod = "POST"
    request.addValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    let body = [
      "grant_type=authorization_code",
      "code=\(code)",
      "client_id=\(client)",
      "redirect_uri=\(redirect)",
      "code_verifier=\(verifier)",
    ].joined(separator: "&")
    request.httpBody = body.data(using: .utf8)

    let (data, _) = try await URLSession.shared.data(for: request)
    struct Response: Decodable {
      let access_token: String
      let refresh_token: String?
      let expires_in: Double?
    }
    let decoded = try JSONDecoder().decode(Response.self, from: data)
    return OAuthToken(
      accessToken: decoded.access_token,
      refreshToken: decoded.refresh_token,
      expiry: decoded.expires_in.map { Date().addingTimeInterval($0) }
    )
  }

  func refresh(config: ProviderConfig, refreshToken: String) async throws -> OAuthToken {
    guard let token = config.tokenEndpoint, let client = config.clientId else {
      throw NSError(domain: "oauth", code: 2, userInfo: [NSLocalizedDescriptionKey: "Refresh not supported"])
    }

    var request = URLRequest(url: token)
    request.httpMethod = "POST"
    request.addValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    let body = [
      "grant_type=refresh_token",
      "refresh_token=\(refreshToken)",
      "client_id=\(client)",
    ].joined(separator: "&")
    request.httpBody = body.data(using: .utf8)

    let (data, _) = try await URLSession.shared.data(for: request)
    struct Response: Decodable {
      let access_token: String
      let refresh_token: String?
      let expires_in: Double?
    }
    let decoded = try JSONDecoder().decode(Response.self, from: data)
    return OAuthToken(
      accessToken: decoded.access_token,
      refreshToken: decoded.refresh_token ?? refreshToken,
      expiry: decoded.expires_in.map { Date().addingTimeInterval($0) }
    )
  }

  private func presentWebAuth(start: URL, scheme: String) async throws -> URL {
    try await withCheckedThrowingContinuation { continuation in
      session = ASWebAuthenticationSession(url: start, callbackURLScheme: scheme) { url, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }
        guard let url else {
          continuation.resume(throwing: NSError(domain: "oauth", code: 3, userInfo: [NSLocalizedDescriptionKey: "Missing callback URL"]))
          return
        }
        continuation.resume(returning: url)
      }
      session?.presentationContextProvider = self
      session?.prefersEphemeralWebBrowserSession = true
      _ = session?.start()
    }
  }

  private func pkce() -> (verifier: String, challenge: String) {
    let verifierData = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
    let verifier = verifierData.base64URLEncodedString()
    let challengeData = Data(SHA256.hash(data: Data(verifier.utf8)))
    let challenge = challengeData.base64URLEncodedString()
    return (verifier, challenge)
  }
}

extension OAuthService: ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first?.keyWindow ?? UIWindow()
  }
}

private extension Data {
  func base64URLEncodedString() -> String {
    base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}
