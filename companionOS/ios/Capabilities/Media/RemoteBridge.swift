import MediaPlayer

final class RemoteBridge {
  static let shared = RemoteBridge()

  private let commandCenter = MPRemoteCommandCenter.shared()
  private let musicPlayer = MPMusicPlayerController.systemMusicPlayer

  private init() {
    commandCenter.nextTrackCommand.isEnabled = true
    commandCenter.previousTrackCommand.isEnabled = true
    commandCenter.changePlaybackPositionCommand.isEnabled = true
  }

  func play() {
    musicPlayer.play()
  }

  func pause() {
    musicPlayer.pause()
  }

  func nextOrQueueFallback(_ fallback: () -> Void) {
    if commandCenter.nextTrackCommand.isEnabled {
      musicPlayer.skipToNextItem()
    } else {
      fallback()
    }
  }

  func prevOrQueueFallback(_ fallback: () -> Void) {
    if commandCenter.previousTrackCommand.isEnabled {
      musicPlayer.skipToPreviousItem()
    } else {
      fallback()
    }
  }

  func seek(to seconds: Double) {
    if commandCenter.changePlaybackPositionCommand.isEnabled {
      musicPlayer.currentPlaybackTime = seconds
    }
  }
}
