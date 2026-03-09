import Foundation
import UIKit

final class ActionsCapability: Capability {
  var domain: String { "actions" }

  func handle(_ message: COSMessage) async -> COSMessage {
    guard message.action == "runShortcut" else {
      return COSMessage(
        op: .response,
        id: message.id,
        domain: domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "unknown_action", message: message.action)
      )
    }

    guard let name = message.payload?["name"]?.value as? String else {
      return COSMessage(
        op: .response,
        id: message.id,
        domain: domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "missing_name", message: "Shortcut name required")
      )
    }

    let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? name
    if let url = URL(string: "shortcuts://run-shortcut?name=\(encoded)") {
      DispatchQueue.main.async {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
      }
    }

    return COSMessage(
      op: .response,
      id: message.id,
      domain: domain,
      action: message.action,
      payload: ["status": AnyCodable("launched")],
      error: nil
    )
  }
}
