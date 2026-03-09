import Foundation

final class NotesCapability: Capability {
  var domain: String { "notes" }

  func handle(_ message: COSMessage) async -> COSMessage {
    switch message.action {
    case "list":
      do {
        struct Note: Decodable {
          let _id: String
          let text: String
          let createdAt: Double
          let tags: [String]?
        }
        let notes: [Note] = try await ConvexClient.shared.call("query/notes:list", ["userId": "me"])
        let items: [[String: AnyCodable]] = notes.map { note in
          [
            "id": AnyCodable(note._id),
            "text": AnyCodable(note.text),
            "createdAt": AnyCodable(note.createdAt),
            "tags": AnyCodable(note.tags ?? []),
          ]
        }
        return COSMessage(
          op: .response,
          id: message.id,
          domain: domain,
          action: message.action,
          payload: ["notes": AnyCodable(items)],
          error: nil
        )
      } catch {
        return COSMessage(
          op: .response,
          id: message.id,
          domain: domain,
          action: message.action,
          payload: nil,
          error: COSError(code: "notes_error", message: error.localizedDescription)
        )
      }

    case "add":
      let text = (message.payload?["text"]?.value as? String) ?? ""
      let tags = message.payload?["tags"]?.value as? [String]
      struct MutationAck: Decodable {}
      do {
        _ = try await ConvexClient.shared.call(
          "mutation/notes:add",
          [
            "userId": "me",
            "text": text,
            "tags": tags ?? [],
          ]
        ) as MutationAck
        return COSMessage(
          op: .response,
          id: message.id,
          domain: domain,
          action: message.action,
          payload: ["status": AnyCodable("saved")],
          error: nil
        )
      } catch {
        return COSMessage(
          op: .response,
          id: message.id,
          domain: domain,
          action: message.action,
          payload: nil,
          error: COSError(code: "notes_error", message: error.localizedDescription)
        )
      }

    default:
      return COSMessage(
        op: .response,
        id: message.id,
        domain: domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "unknown_action", message: message.action)
      )
    }
  }
}
