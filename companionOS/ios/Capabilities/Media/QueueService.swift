import Foundation

final class QueueService {
  static let shared = QueueService()

  private let cacheName = "queue.json"

  private init() {}

  func list(userId: String) async -> [QueueItem] {
    if let items: [QueueItem] = LocalCache.shared.read(cacheName, as: [QueueItem].self) {
      return items
    }
    await syncFromConvex(userId: userId)
    return LocalCache.shared.read(cacheName, as: [QueueItem].self) ?? []
  }

  @discardableResult
  func syncFromConvex(userId: String) async -> [QueueItem] {
    struct Item: Decodable {
      let _id: String
      let userId: String
      let source: String
      let originalURL: String
      let normalizedURL: String
      let videoId: String?
      let title: String
      let thumbnailURL: String?
      let duration: Double?
      let addedAt: Double
    }

    do {
      let rows: [Item] = try await ConvexClient.shared.call("query/queue:list", ["userId": userId])
      let mapped = rows.compactMap { row -> QueueItem? in
        guard let original = URL(string: row.originalURL) else { return nil }
        let normalized = URL(string: row.normalizedURL) ?? original
        return QueueItem(
          source: row.source,
          originalURL: original,
          normalizedURL: normalized,
          videoId: row.videoId,
          title: row.title,
          thumbnailURL: row.thumbnailURL.flatMap(URL.init(string:)),
          duration: row.duration.map(TimeInterval.init),
          addedAt: Date(timeIntervalSince1970: row.addedAt / 1000)
        )
      }
      LocalCache.shared.write(cacheName, mapped)
      return mapped
    } catch {
      #if DEBUG
      print("Queue sync error", error)
      #endif
      return LocalCache.shared.read(cacheName, as: [QueueItem].self) ?? []
    }
  }

  func add(_ item: QueueItem, userId: String) async {
    let payload: [String: Any] = [
      "userId": userId,
      "source": item.source,
      "originalURL": item.originalURL.absoluteString,
      "normalizedURL": item.normalizedURL.absoluteString,
      "videoId": item.videoId as Any,
      "title": item.title,
      "thumbnailURL": item.thumbnailURL?.absoluteString as Any,
      "duration": item.duration as Any,
      "tags": item.tags,
    ]

    struct MutationAck: Decodable {}
    _ = try? await ConvexClient.shared.call("mutation/queue:add", payload) as MutationAck
    await syncFromConvex(userId: userId)
  }
}
