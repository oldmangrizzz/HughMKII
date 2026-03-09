import Foundation

final class SearchCapability: Capability {
  var domain: String { "search" }

  func handle(_ message: COSMessage) async -> COSMessage {
    guard message.action == "query" else {
      return COSMessage(
        op: .response,
        id: message.id,
        domain: domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "unknown_action", message: message.action)
      )
    }

    let term = ((message.payload?["term"]?.value as? String) ?? "").lowercased()

    async let queueItems = QueueService.shared.list(userId: "me")
    async let notesResult: [Note] = fetchNotes()

    do {
      let (queue, notes) = try await (queueItems, notesResult)
      let matchingQueue = queue.filter { item in
        term.isEmpty || item.title.lowercased().contains(term)
      }
      let matchingNotes = notes.filter { note in
        term.isEmpty || note.text.lowercased().contains(term)
      }

      let queuePayload: [[String: AnyCodable]] = matchingQueue.map { item in
        [
          "title": AnyCodable(item.title),
          "source": AnyCodable(item.source),
          "url": AnyCodable(item.normalizedURL.absoluteString),
        ]
      }
      let notesPayload: [[String: AnyCodable]] = matchingNotes.map { note in
        [
          "id": AnyCodable(note.id),
          "text": AnyCodable(note.text),
        ]
      }

      return COSMessage(
        op: .response,
        id: message.id,
        domain: domain,
        action: message.action,
        payload: [
          "queue": AnyCodable(queuePayload),
          "notes": AnyCodable(notesPayload),
        ],
        error: nil
      )
    } catch {
      return COSMessage(
        op: .response,
        id: message.id,
        domain: domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "search_error", message: error.localizedDescription)
      )
    }
  }
}

private struct Note: Decodable {
  let _id: String
  let text: String

  var id: String { _id }
}

private extension SearchCapability {
  func fetchNotes() async throws -> [Note] {
    try await ConvexClient.shared.call("query/notes:list", ["userId": "me"])
  }
}
