import Foundation

protocol Capability {
  var domain: String { get }
  func handle(_ message: COSMessage) async -> COSMessage
}

final class CapabilityBus {
  static let shared = CapabilityBus()

  private var capabilities: [String: Capability] = [:]

  func register(_ capability: Capability) {
    capabilities[capability.domain] = capability
  }

  func route(_ message: COSMessage) async -> COSMessage {
    guard let capability = capabilities[message.domain] else {
      return COSMessage(
        op: .response,
        id: message.id,
        domain: message.domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "no_capability", message: "No handler for domain")
      )
    }
    return await capability.handle(message)
  }

  func bootstrap() {
    register(MediaCapability())
    register(CommsCapability())
    register(ActionsCapability())
    register(NotesCapability())
    register(SearchCapability())
    AutoNextMonitor.shared.start()
  }
}
