import Foundation

enum URLRouter {
  static func youtubeWatchURL(videoId: String) -> URL {
    if let url = URL(string: "youtube://watch?v=\(videoId)") {
      return url
    }
    return URL(string: "https://www.youtube.com/watch?v=\(videoId)")!
  }

  static func youtubeSearchURL(query: String) -> URL {
    let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
    if let url = URL(string: "youtube://results?search_query=\(encoded)") {
      return url
    }
    return URL(string: "https://www.youtube.com/results?search_query=\(encoded)")!
  }

  static func normalized(from url: URL) -> URL {
    url
  }
}
