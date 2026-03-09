import Foundation

enum Constants {
  static let appGroup = ProcessInfo.processInfo.environment["APP_GROUP_ID"] ??
    "group.com.your.bundle.companion"
  static let convexURL = "https://precise-alpaca-984.convex.cloud"
  static let convexAuth = ProcessInfo.processInfo.environment["CONVEX_AUTH_TOKEN"] ?? ""
  static let bundlePrefix = ProcessInfo.processInfo.environment["BUNDLE_PREFIX"] ?? "com.your.bundle"

  // OAuth config
  static let googleClientId = ProcessInfo.processInfo.environment["GOOGLE_CLIENT_ID"]
  static let googleRedirect = ProcessInfo.processInfo.environment["GOOGLE_REDIRECT_URI"]
  static let openaiAuthEndpoint = ProcessInfo.processInfo.environment["OPENAI_AUTH_ENDPOINT"]
  static let openaiTokenEndpoint = ProcessInfo.processInfo.environment["OPENAI_TOKEN_ENDPOINT"]
  static let openaiClientId = ProcessInfo.processInfo.environment["OPENAI_CLIENT_ID"]
  static let openaiRedirect = ProcessInfo.processInfo.environment["OPENAI_REDIRECT_URI"]
  static let openaiScopes = ProcessInfo.processInfo.environment["OPENAI_SCOPES"]?.components(separatedBy: " ")

  // Fallback API keys
  static let openaiApiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"]
  static let googleApiKey = ProcessInfo.processInfo.environment["GOOGLE_API_KEY"]
  static let localBaseURL = ProcessInfo.processInfo.environment["LOCAL_LLM_BASE_URL"] ?? "http://127.0.0.1:11434"
  static let localBearer = ProcessInfo.processInfo.environment["LOCAL_LLM_BEARER"]
}
