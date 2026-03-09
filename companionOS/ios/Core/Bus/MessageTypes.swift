import Foundation

public struct COSMessage: Codable {
  public enum Op: String, Codable {
    case request
    case response
    case event
  }

  public var op: Op
  public var id: String
  public var domain: String
  public var action: String
  public var payload: [String: AnyCodable]?
  public var error: COSError?

  public init(
    op: Op,
    id: String = UUID().uuidString,
    domain: String,
    action: String,
    payload: [String: AnyCodable]? = nil,
    error: COSError? = nil
  ) {
    self.op = op
    self.id = id
    self.domain = domain
    self.action = action
    self.payload = payload
    self.error = error
  }
}

public struct COSError: Codable {
  public let code: String
  public let message: String
}

public struct AnyCodable: Codable {
  public let value: Any

  public init(_ value: Any) {
    self.value = value
  }

  public init(from decoder: Decoder) throws {
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
      throw DecodingError.dataCorruptedError(
        in: container,
        debugDescription: "Unsupported AnyCodable value",
      )
    }
  }

  public func encode(to encoder: Encoder) throws {
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
    case let data as Data:
      try container.encode(data.base64EncodedString())
    case Optional<Any>.none:
      try container.encodeNil()
    default:
      try container.encodeNil()
    }
  }
}
