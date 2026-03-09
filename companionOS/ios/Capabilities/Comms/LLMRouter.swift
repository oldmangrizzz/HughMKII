import Foundation

struct ChatRequest: Codable {
  let router: String?
  let text: String
  let threadId: String?
  let command: String?
  let meta: [String: String]?
}

struct ChatResponse: Codable {
  let text: String
}

protocol LLMProvider {
  var id: String { get }
  func chat(_ request: ChatRequest, token: String?) async throws -> ChatResponse
}

final class LLMRouter {
  static let shared = LLMRouter()

  private var providers: [String: LLMProvider] = [:]
  private var configs: [String: ProviderConfig] = [:]

  private init() {}

  func register(_ provider: LLMProvider, config: ProviderConfig) {
    providers[provider.id] = provider
    configs[provider.id] = config
  }

  private func token(for provider: String) async throws -> String? {
    guard let config = configs[provider] else { return nil }

    if !config.usesOAuth {
      if provider == "openai", let key = Constants.openaiApiKey, !key.isEmpty {
        return key
      }
      if provider == "gemini", let key = Constants.googleApiKey, !key.isEmpty {
        return key
      }
      return nil
    }

    if let saved = TokenStore.load(provider: provider) {
      if let expiry = saved.expiry, expiry.timeIntervalSinceNow > 60 {
        return saved.accessToken
      }
      if let refreshToken = saved.refreshToken,
         let refreshed = try? await OAuthService.shared.refresh(config: config, refreshToken: refreshToken) {
        TokenStore.save(refreshed, provider: provider)
        return refreshed.accessToken
      }
    }

    let fresh = try await OAuthService.shared.signIn(config: config)
    TokenStore.save(fresh, provider: provider)
    return fresh.accessToken
  }

  func route(_ request: ChatRequest, userId: String) async throws -> ChatResponse {
    let preferredRouter = request.router ?? UserDefaults.standard.string(forKey: "cos.lastRouter") ?? "gemini"
    guard let provider = providers[preferredRouter] else {
      throw NSError(domain: "llm", code: 404, userInfo: [NSLocalizedDescriptionKey: "Provider not registered"])
    }

    let token = try await self.token(for: provider.id)
    let response = try await provider.chat(request, token: token)
    UserDefaults.standard.setValue(provider.id, forKey: "cos.lastRouter")
    return response
  }
}
