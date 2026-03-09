import CarPlay
import Foundation

@available(iOS 14.0, *)
/// Bridges CarPlay scene lifecycle events into the CompanionOS capability stack so the
/// CarPlay dashboard always reflects the same autonomy-first behaviors as the watch and phone.
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var controller: CarPlayInterfaceController?

  /// When CarPlay connects, bootstrap the shared template controller and load the home dashboard.
  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController,
    to window: CPWindow
  ) {
    let controller = CarPlayInterfaceController(interfaceController: interfaceController)
    controller.configureRootInterface()
    self.controller = controller
  }

  /// Tear down references when CarPlay disconnects to keep memory usage predictable.
  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnect interfaceController: CPInterfaceController,
    from window: CPWindow
  ) {
    controller = nil
  }
}
