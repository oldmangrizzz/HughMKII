import Foundation

final class LocalCache {
  static let shared = LocalCache()

  private let directory: URL

  private init() {
    if let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Constants.appGroup) {
      directory = url
    } else {
      directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    }
  }

  private func url(for name: String) -> URL {
    directory.appendingPathComponent(name, isDirectory: false)
  }

  func read<T: Decodable>(_ name: String, as type: T.Type) -> T? {
    let file = url(for: name)
    guard let data = try? Data(contentsOf: file) else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
  }

  func write<T: Encodable>(_ name: String, _ value: T) {
    let file = url(for: name)
    do {
      let data = try JSONEncoder().encode(value)
      try data.write(to: file, options: .atomic)
    } catch {
      #if DEBUG
      print("LocalCache write error", error)
      #endif
    }
  }
}
