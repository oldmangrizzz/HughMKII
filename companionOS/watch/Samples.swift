import Foundation

enum WatchSamples {
  static func requestNowPlaying() -> COSMessage {
    COSMessage(op: .request, domain: "media", action: "state")
  }

  static func play() -> COSMessage {
    COSMessage(op: .request, domain: "media", action: "play")
  }

  static func next() -> COSMessage {
    COSMessage(op: .request, domain: "media", action: "next")
  }

  static func chatGemini(_ text: String) -> COSMessage {
    COSMessage(
      op: .request,
      domain: "comms",
      action: "chat",
      payload: [
        "router": AnyCodable("gemini"),
        "text": AnyCodable(text),
      ]
    )
  }

  static func runShortcut(_ name: String) -> COSMessage {
    COSMessage(
      op: .request,
      domain: "actions",
      action: "runShortcut",
      payload: [
        "name": AnyCodable(name),
      ]
    )
  }
}
