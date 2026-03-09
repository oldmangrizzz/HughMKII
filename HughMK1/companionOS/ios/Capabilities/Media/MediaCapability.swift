import Foundation

final class MediaCapability: Capability {
  var domain: String { "media" }

  static func playNext() async {
    let items = await QueueService.shared.list(userId: "me")
    guard let first = items.first else { return }
    Launcher.play(first)
  }

  func handle(_ message: COSMessage) async -> COSMessage {
    switch message.action {
    case "play":
      RemoteBridge.shared.play()
    case "pause":
      RemoteBridge.shared.pause()
    case "next":
      RemoteBridge.shared.nextOrQueueFallback {
        Task { await Self.playNext() }
      }
    case "prev":
      RemoteBridge.shared.prevOrQueueFallback {}
    case "seek":
      if let seconds = message.payload?["seconds"]?.value as? Double {
        RemoteBridge.shared.seek(to: seconds)
      } else if let seconds = message.payload?["seconds"]?.value as? Int {
        RemoteBridge.shared.seek(to: Double(seconds))
      }
    case "state":
      let snapshot = NowPlayingMirror.shared.snapshot()
      if let data = try? JSONEncoder().encode(snapshot),
         let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        let payload = object.mapValues { AnyCodable($0) }
        return COSMessage(
          op: .response,
          id: message.id,
          domain: message.domain,
          action: message.action,
          payload: payload,
          error: nil
        )
      }
    default:
      return COSMessage(
        op: .response,
        id: message.id,
        domain: message.domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "unknown_action", message: message.action)
      )
    }

    return COSMessage(
      op: .response,
      id: message.id,
      domain: message.domain,
      action: message.action,
      payload: nil,
      error: nil
    )
  }
}
