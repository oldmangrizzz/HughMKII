import CarPlay
import Foundation

@available(iOS 14.0, *)
@MainActor
/// Routes capability messages from CarPlay templates through the shared CapabilityBus.
/// Responsible for presenting success/error alerts that keep the driver informed without
/// forcing them back to the phone.
final class CarPlayCapabilityDispatcher {
  private weak var interfaceController: CPInterfaceController?
  private let bus: CapabilityBus

  init(interfaceController: CPInterfaceController, bus: CapabilityBus = .shared) {
    self.interfaceController = interfaceController
    self.bus = bus
  }

  /// Dispatches a capability request to the CompanionOS bus and relays the result as
  /// a CarPlay alert. Optionally supply a success title/message to confirm the action.
  func dispatch(
    domain: String,
    action: String,
    payload: [String: AnyCodable]? = nil,
    successTitle: String? = nil,
    successMessage: String? = nil
  ) {
    Task {
      let response = await bus.route(
        COSMessage(
          op: .request,
          domain: domain,
          action: action,
          payload: payload
        )
      )

      if let error = response.error {
        presentAlert(
          title: "Action Failed",
          message: error.message
        )
        return
      }

      guard let successTitle, let successMessage else { return }

      presentAlert(
        title: successTitle,
        message: successMessage
      )
    }
  }

  /// Presents a CarPlay alert with an accessible OK action so drivers can acknowledge
  /// feedback without leaving the wheel.
  func presentAlert(title: String, message: String) {
    guard let interfaceController else { return }

    let dismiss = CPAlertAction(title: "OK", style: .default) { [weak self] _ in
      self?.interfaceController?.dismissTemplate(animated: true, completion: nil)
    }

    let alert = CPAlertTemplate(titleVariants: [title], actions: [dismiss])
    alert.subtitleVariants = [message]

    if interfaceController.presentedTemplate != nil {
      interfaceController.dismissTemplate(animated: false) { [weak self] in
        self?.interfaceController?.presentTemplate(alert, animated: true)
      }
    } else {
      interfaceController.presentTemplate(alert, animated: true)
    }
  }
}
