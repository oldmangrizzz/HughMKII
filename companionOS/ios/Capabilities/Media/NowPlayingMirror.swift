import Foundation
import MediaPlayer
import UIKit

struct CompactNowPlaying: Codable {
  var title: String?
  var appName: String?
  var isPlaying: Bool
  var elapsed: Double?
  var duration: Double?
  var supports: [String: Bool]
}

final class NowPlayingMirror {
  static let shared = NowPlayingMirror()

  private init() {}

  func snapshot() -> CompactNowPlaying {
    let info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    let title = info[MPMediaItemPropertyTitle] as? String
    let elapsed = info[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? Double
    let duration = info[MPMediaItemPropertyPlaybackDuration] as? Double
    let rate = info[MPNowPlayingInfoPropertyPlaybackRate] as? Double ?? 0

    let commandCenter = MPRemoteCommandCenter.shared()
    let supports: [String: Bool] = [
      "next": commandCenter.nextTrackCommand.isEnabled,
      "prev": commandCenter.previousTrackCommand.isEnabled,
      "seek": commandCenter.changePlaybackPositionCommand.isEnabled,
      "play": commandCenter.playCommand.isEnabled,
      "pause": commandCenter.pauseCommand.isEnabled,
    ]

    var appName: String?
    if let bundleIdentifier = info["kMRMediaRemoteNowPlayingApplicationDisplayID"] as? String {
      appName = Bundle(identifier: bundleIdentifier)?.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
        ?? Bundle(identifier: bundleIdentifier)?.object(forInfoDictionaryKey: "CFBundleName") as? String
    }

    return CompactNowPlaying(
      title: title,
      appName: appName,
      isPlaying: rate > 0,
      elapsed: elapsed,
      duration: duration,
      supports: supports
    )
  }
}
