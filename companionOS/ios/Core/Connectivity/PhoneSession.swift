import Foundation
import WatchConnectivity

final class PhoneSession: NSObject, WCSessionDelegate {
  static let shared = PhoneSession()

  private override init() {
    super.init()
  }

  func start() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    Task {
      guard
        let data = message["data"] as? Data,
        let request = try? JSONDecoder().decode(COSMessage.self, from: data)
      else {
        replyHandler(["error": "bad_message"])
        return
      }

      let response = await CapabilityBus.shared.route(request)
      let encoded = (try? JSONEncoder().encode(response)) ?? Data()
      replyHandler(["data": encoded])
    }
  }

  // MARK: - WCSessionDelegate stubs

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  #if os(iOS)
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }
  #endif
}
