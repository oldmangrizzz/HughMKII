import Foundation
import WatchConnectivity

final class WatchSession: NSObject, WCSessionDelegate, ObservableObject {
  static let shared = WatchSession()

  @Published var lastResponse: Data?

  private override init() {
    super.init()
  }

  func start() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func send(_ message: COSMessage, completion: @escaping (Result<COSMessage, Error>) -> Void) {
    guard WCSession.default.isReachable else {
      completion(.failure(NSError(domain: "wc", code: 0, userInfo: [NSLocalizedDescriptionKey: "Phone unreachable"])))
      return
    }

    do {
      let data = try JSONEncoder().encode(message)
      WCSession.default.sendMessage(["data": data], replyHandler: { reply in
        if let responseData = reply["data"] as? Data,
           let response = try? JSONDecoder().decode(COSMessage.self, from: responseData) {
          completion(.success(response))
        } else if let error = reply["error"] as? String {
          completion(.failure(NSError(domain: "wc", code: 1, userInfo: [NSLocalizedDescriptionKey: error])))
        } else {
          completion(.failure(NSError(domain: "wc", code: 2, userInfo: [NSLocalizedDescriptionKey: "Bad reply"])))
        }
      }, errorHandler: { error in
        completion(.failure(error))
      })
    } catch {
      completion(.failure(error))
    }
  }

  // MARK: - WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  #if os(watchOS)
  func sessionReachabilityDidChange(_ session: WCSession) {}
  #endif
}

struct COSMessage: Codable {
  enum Op: String, Codable {
    case request
    case response
    case event
  }

  var op: Op
  var id: String
  var domain: String
  var action: String
  var payload: [String: AnyCodable]?
  var error: COSError?

  init(op: Op, domain: String, action: String, payload: [String: AnyCodable]? = nil) {
    self.op = op
    self.id = UUID().uuidString
    self.domain = domain
    self.action = action
    self.payload = payload
  }
}

struct COSError: Codable {
  let code: String
  let message: String
}

struct AnyCodable: Codable {
  let value: Any

  init(_ value: Any) {
    self.value = value
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let bool = try? container.decode(Bool.self) {
      value = bool
    } else if let int = try? container.decode(Int.self) {
      value = int
    } else if let double = try? container.decode(Double.self) {
      value = double
    } else if let string = try? container.decode(String.self) {
      value = string
    } else if let dict = try? container.decode([String: AnyCodable].self) {
      value = dict
    } else if let array = try? container.decode([AnyCodable].self) {
      value = array
    } else if container.decodeNil() {
      value = Optional<Any>.none as Any
    } else {
      throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported value")
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch value {
    case let bool as Bool:
      try container.encode(bool)
    case let int as Int:
      try container.encode(int)
    case let double as Double:
      try container.encode(double)
    case let string as String:
      try container.encode(string)
    case let dict as [String: AnyCodable]:
      try container.encode(dict)
    case let array as [AnyCodable]:
      try container.encode(array)
    case Optional<Any>.none:
      try container.encodeNil()
    default:
      try container.encodeNil()
    }
  }
}
