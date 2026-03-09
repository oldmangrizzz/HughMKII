import Foundation

enum Constants {
  static let appGroup = "group.com.grizzlymedicine.companion"
  static let bundlePrefix = "com.grizzlymedicine"

  // MARK: - Convex (prod deployment)
  // MARK: - Upgrade to ConvexMobile SDK: https://github.com/get-convex/convex-swift
  static let convexURL = "https://sincere-albatross-464.convex.cloud"
  static let convexAuth = "" // Public/auth-based access; set admin key only for server-side tools

  // MARK: - H.U.G.H. API
  static let hughAPIURL = "https://api.grizzlymedicine.icu"
  static let hughHealthURL = "https://api.grizzlymedicine.icu/health"

  // MARK: - Home Assistant
  static let haURL = "http://192.168.7.194:8123"
  // NOTE: Move haToken to Keychain before App Store submission
  static let haToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3MGM1ZjA4YWRiZTg0ZTM2YTI0YmY5M2I4ZDNkODdlNyIsImlhdCI6MTc3MzA4OTY3NSwiZXhwIjoyMDg4NDQ5Njc1fQ.JnitS57smDEOUSCrrlJij5SpWz24zIa34Ur7IuI-vPQ"

  // MARK: - LFM Inference
  // Proxied via H.U.G.H. API nginx; direct fallback at 187.124.28.147:8080
  static let lfmInferenceURL = "https://api.grizzlymedicine.icu"          // proxied
  static let lfmDirectURL    = "http://187.124.28.147:8080"               // direct fallback
  static let lfmChatPath     = "/v1/chat/completions"                     // OpenAI-compatible

  // MARK: - OAuth config
  static let googleClientId = ProcessInfo.processInfo.environment["GOOGLE_CLIENT_ID"]
  static let googleRedirect = ProcessInfo.processInfo.environment["GOOGLE_REDIRECT_URI"]
  static let openaiAuthEndpoint = ProcessInfo.processInfo.environment["OPENAI_AUTH_ENDPOINT"]
  static let openaiTokenEndpoint = ProcessInfo.processInfo.environment["OPENAI_TOKEN_ENDPOINT"]
  static let openaiClientId = ProcessInfo.processInfo.environment["OPENAI_CLIENT_ID"]
  static let openaiRedirect = ProcessInfo.processInfo.environment["OPENAI_REDIRECT_URI"]
  static let openaiScopes = ProcessInfo.processInfo.environment["OPENAI_SCOPES"]?.components(separatedBy: " ")

  // MARK: - Fallback API keys
  static let openaiApiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"]
  static let googleApiKey = ProcessInfo.processInfo.environment["GOOGLE_API_KEY"]
  /// Legacy local LLM base URL (Ollama etc.); prefer lfmInferenceURL for H.U.G.H. inference
  static let localBaseURL = ProcessInfo.processInfo.environment["LOCAL_LLM_BASE_URL"] ?? Constants.lfmInferenceURL
  static let localBearer = ProcessInfo.processInfo.environment["LOCAL_LLM_BEARER"]
}
