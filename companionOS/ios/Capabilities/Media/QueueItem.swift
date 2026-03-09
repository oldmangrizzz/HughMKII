import Foundation

public struct QueueItem: Codable, Equatable, Identifiable {
  public let id: UUID
  public var source: String
  public var originalURL: URL
  public var normalizedURL: URL
  public var videoId: String?
  public var title: String
  public var thumbnailURL: URL?
  public var duration: TimeInterval?
  public var addedAt: Date
  public var tags: [String]

  public init(
    id: UUID = UUID(),
    source: String,
    originalURL: URL,
    normalizedURL: URL,
    videoId: String? = nil,
    title: String,
    thumbnailURL: URL? = nil,
    duration: TimeInterval? = nil,
    addedAt: Date = Date(),
    tags: [String] = []
  ) {
    self.id = id
    self.source = source
    self.originalURL = originalURL
    self.normalizedURL = normalizedURL
    self.videoId = videoId
    self.title = title
    self.thumbnailURL = thumbnailURL
    self.duration = duration
    self.addedAt = addedAt
    self.tags = tags
  }
}
