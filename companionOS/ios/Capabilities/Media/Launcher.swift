import UIKit

enum Launcher {
  static func open(_ url: URL) {
    DispatchQueue.main.async {
      UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
  }

  static func play(_ item: QueueItem) {
    open(item.normalizedURL)
  }
}
