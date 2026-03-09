import Foundation

final class CommsCapability: Capability {
  var domain: String { "comms" }

  init() {
    LLMRouter.shared.register(GoogleAIProvider(), config: .gemini)
    LLMRouter.shared.register(OpenAIProvider(), config: .openAIProxy)
    LLMRouter.shared.register(LocalHTTPProvider(), config: .localHTTP)
  }

  func handle(_ message: COSMessage) async -> COSMessage {
    guard message.action == "chat" else {
      return COSMessage(
        op: .response,
        id: message.id,
        domain: message.domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "unknown_action", message: message.action)
      )
    }

    let text = (message.payload?["text"]?.value as? String) ?? ""
    let router = message.payload?["router"]?.value as? String
    let threadId = message.payload?["threadId"]?.value as? String

    let request = ChatRequest(router: router, text: text, threadId: threadId, command: nil, meta: nil)
    do {
      let response = try await LLMRouter.shared.route(request, userId: "me")
      return COSMessage(
        op: .response,
        id: message.id,
        domain: message.domain,
        action: message.action,
        payload: ["text": AnyCodable(response.text)],
        error: nil
      )
    } catch {
      return COSMessage(
        op: .response,
        id: message.id,
        domain: message.domain,
        action: message.action,
        payload: nil,
        error: COSError(code: "chat_error", message: error.localizedDescription)
      )
    }
  }
}
