import Foundation

struct ProviderConfig {
  let id: String
  let authEndpoint: URL?
  let tokenEndpoint: URL?
  let clientId: String?
  let redirectURI: String?
  let scopes: [String]
  let usesOAuth: Bool

  static var gemini: ProviderConfig {
    ProviderConfig(
      id: "gemini",
      authEndpoint: URL(string: "https://accounts.google.com/o/oauth2/v2/auth"),
      tokenEndpoint: URL(string: "https://oauth2.googleapis.com/token"),
      clientId: Constants.googleClientId,
      redirectURI: Constants.googleRedirect,
      scopes: [
        "https://www.googleapis.com/auth/generative-language",
        "openid",
        "email",
        "profile",
        "offline_access",
      ],
      usesOAuth: true
    )
  }

  static var openAIProxy: ProviderConfig {
    guard
      let auth = Constants.openaiAuthEndpoint,
      let token = Constants.openaiTokenEndpoint,
      let clientId = Constants.openaiClientId,
      let redirect = Constants.openaiRedirect
    else {
      return ProviderConfig(
        id: "openai",
        authEndpoint: nil,
        tokenEndpoint: nil,
        clientId: nil,
        redirectURI: nil,
        scopes: [],
        usesOAuth: false
      )
    }

    return ProviderConfig(
      id: "openai",
      authEndpoint: URL(string: auth),
      tokenEndpoint: URL(string: token),
      clientId: clientId,
      redirectURI: redirect,
      scopes: Constants.openaiScopes ?? ["openid", "offline_access", "api"],
      usesOAuth: true
    )
  }

  static var localHTTP: ProviderConfig {
    ProviderConfig(
      id: "localHTTP",
      authEndpoint: nil,
      tokenEndpoint: nil,
      clientId: nil,
      redirectURI: nil,
      scopes: [],
      usesOAuth: false
    )
  }
}
