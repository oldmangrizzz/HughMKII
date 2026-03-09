import CarPlay
import Foundation

@available(iOS 14.0, *)
@MainActor
/// Coordinates the CarPlay template stack and translates driver intent into CompanionOS
/// capability messages. Designed to provide quick, eyes-up access to the same autonomy tools
/// available on watch and phone without duplicating backend logic.
final class CarPlayInterfaceController {
  private let interfaceController: CPInterfaceController
  private let dispatcher: CarPlayCapabilityDispatcher
  private let bus: CapabilityBus
  private let dateFormatter: DateFormatter

  init(interfaceController: CPInterfaceController, bus: CapabilityBus = .shared) {
    self.interfaceController = interfaceController
    self.bus = bus
    self.dispatcher = CarPlayCapabilityDispatcher(interfaceController: interfaceController, bus: bus)

    let formatter = DateFormatter()
    formatter.dateStyle = .short
    formatter.timeStyle = .short
    formatter.locale = .current
    self.dateFormatter = formatter
  }

  /// Sets up the initial CarPlay dashboard template with media, notes, and safety lanes.
  func configureRootInterface() {
    let template = CPListTemplate(
      title: "CompanionOS",
      sections: [
        mediaSection(),
        notesSection(),
        safetySection(),
      ]
    )
    template.emptyViewTitleVariants = ["No Content Available"]
    template.emptyViewSubtitleVariants = ["Actions appear when capabilities respond from your phone or Convex deployment."]

    interfaceController.setRootTemplate(template, animated: true)
  }

  /// Media controls map directly to the shared media capability so the queue stays in sync.
  private func mediaSection() -> CPListSection {
    let resume = CPListItem(text: "Resume Playback", detailText: "Play the active queue")
    resume.handler = { [weak self] _, completion in
      completion()
      self?.dispatcher.dispatch(
        domain: "media",
        action: "play",
        successTitle: "Playback",
        successMessage: "CompanionOS resumed your media queue."
      )
    }

    let pause = CPListItem(text: "Pause", detailText: "Pause current playback")
    pause.handler = { [weak self] _, completion in
      completion()
      self?.dispatcher.dispatch(
        domain: "media",
        action: "pause",
        successTitle: "Playback",
        successMessage: "Playback paused for focus on the road."
      )
    }

    let next = CPListItem(text: "Next", detailText: "Skip to the next track")
    next.handler = { [weak self] _, completion in
      completion()
      self?.dispatcher.dispatch(
        domain: "media",
        action: "next",
        successTitle: "Playback",
        successMessage: "Skipping ahead in your queue."
      )
    }

    let nowPlaying = CPListItem(text: "Now Playing", detailText: "Open rich controls")
    nowPlaying.handler = { [weak self] _, completion in
      completion()
      self?.showNowPlaying()
    }

    return CPListSection(items: [resume, pause, next, nowPlaying])
  }

  /// Surfaces recent notes and educates the driver on voice capture gestures from the watch.
  private func notesSection() -> CPListSection {
    let recentNotes = CPListItem(text: "Review Notes", detailText: "Listen back to quick captures")
    recentNotes.handler = { [weak self] _, completion in
      completion()
      self?.presentNotesList()
    }

    let captureReminder = CPListItem(text: "Capture Reminder", detailText: "Use voice on watch to add notes")
    captureReminder.handler = { [weak self] _, completion in
      completion()
      self?.dispatcher.presentAlert(
        title: "Hands-Free Capture",
        message: "Double clench on the watch to capture a note with your voice."
      )
    }

    return CPListSection(items: [recentNotes, captureReminder])
  }

  /// Bundles safety-oriented shortcuts so responders can notify partners without digging for a phone.
  private func safetySection() -> CPListSection {
    let shareEta = CPListItem(text: "Share ETA", detailText: "Notify your safety contact")
    shareEta.handler = { [weak self] _, completion in
      completion()
      let payload: [String: AnyCodable] = [
        "name": AnyCodable("Share ETA"),
        "origin": AnyCodable("carplay")
      ]
      self?.dispatcher.dispatch(
        domain: "actions",
        action: "runShortcut",
        payload: payload,
        successTitle: "Shortcut Sent",
        successMessage: "Shared your ETA using the configured shortcut."
      )
    }

    let navigationHome = CPListItem(text: "Navigate Home", detailText: "Trigger your go-home routine")
    navigationHome.handler = { [weak self] _, completion in
      completion()
      let payload: [String: AnyCodable] = [
        "name": AnyCodable("Navigate Home"),
        "origin": AnyCodable("carplay")
      ]
      self?.dispatcher.dispatch(
        domain: "actions",
        action: "runShortcut",
        payload: payload,
        successTitle: "Navigation",
        successMessage: "Launching your home navigation routine."
      )
    }

    return CPListSection(items: [shareEta, navigationHome])
  }

  /// Presents the system Now Playing template for richer playback controls.
  private func showNowPlaying() {
    interfaceController.pushTemplate(CPNowPlayingTemplate.shared, animated: true)
  }

  /// Queries the Convex-backed notes capability and renders the results into a CarPlay list.
  private func presentNotesList() {
    Task {
      let response = await bus.route(
        COSMessage(
          op: .request,
          domain: "notes",
          action: "list",
          payload: ["limit": AnyCodable(25)]
        )
      )

      guard response.error == nil else {
        dispatcher.presentAlert(
          title: "Notes Unavailable",
          message: response.error?.message ?? "Unknown error"
        )
        return
      }

      guard
        let rawNotes = response.payload?["notes"]?.value as? [[String: AnyCodable]]
      else {
        dispatcher.presentAlert(
          title: "No Notes Found",
          message: "Capture a note on watch or phone to review it here."
        )
        return
      }

      let items: [CPListItem] = rawNotes.compactMap { note in
        guard let text = note["text"]?.value as? String else { return nil }
        // Convex stores timestamps in milliseconds; normalize for driver-friendly display.
        let createdAtMillis: Double
        if let double = note["createdAt"]?.value as? Double {
          createdAtMillis = double
        } else if let int = note["createdAt"]?.value as? Int {
          createdAtMillis = Double(int)
        } else {
          createdAtMillis = Date().timeIntervalSince1970 * 1000
        }
        let createdAtDate = Date(timeIntervalSince1970: createdAtMillis / 1000)
        let detail = dateFormatter.string(from: createdAtDate)

        let item = CPListItem(text: text, detailText: detail)
        item.handler = { [weak self] _, completion in
          completion()
          self?.dispatcher.presentAlert(title: "Pinned", message: "This note stays visible for quick recall.")
        }
        return item
      }

      let section = CPListSection(items: items)
      let template = CPListTemplate(title: "Recent Notes", sections: [section])
      template.emptyViewTitleVariants = ["No Notes Yet"]
      template.emptyViewSubtitleVariants = ["Use your watch to capture a reminder and it appears instantly."]

      interfaceController.pushTemplate(template, animated: true)
    }
  }

}
