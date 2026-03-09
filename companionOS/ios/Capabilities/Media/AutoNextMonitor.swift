import Foundation

final class AutoNextMonitor {
  static let shared = AutoNextMonitor()

  private var timer: Timer?
  var enabled = true
  var threshold: Double = 8.0

  private init() {}

  func start() {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
      self?.tick()
    }
  }

  private func tick() {
    guard enabled else { return }
    let snapshot = NowPlayingMirror.shared.snapshot()
    if let duration = snapshot.duration,
       let elapsed = snapshot.elapsed,
       (duration - elapsed) < threshold,
       snapshot.isPlaying == false {
      Task {
        await MediaCapability.playNext()
      }
    }
  }
}
