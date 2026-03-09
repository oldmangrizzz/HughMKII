// WorkshopLiveFeed.swift — tvOS
// Shows a WebView of workshop.grizzlymedicine.icu as a live workshop feed.
// Uses WKWebView wrapped in UIViewRepresentable (tvOS supports WebKit).

import SwiftUI
import WebKit

struct WorkshopLiveFeed: View {
    @State private var isLoading = true
    @State private var loadError: String?

    private let workshopURL = URL(string: "https://workshop.grizzlymedicine.icu")!

    var body: some View {
        ZStack {
            Color(red: 0, green: 0, blue: 0.04).ignoresSafeArea()
            WorkshopWebView(url: workshopURL, isLoading: $isLoading, loadError: $loadError)
                .ignoresSafeArea()
            if isLoading {
                VStack(spacing: 16) {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                    Text("Connecting to Workshop...")
                        .font(.system(size: 18, weight: .light, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            if let err = loadError {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48))
                        .foregroundStyle(.orange)
                    Text("Workshop feed unavailable")
                        .font(.headline).foregroundStyle(.white)
                    Text(err)
                        .font(.caption).foregroundStyle(.white.opacity(0.5))
                }
            }
        }
    }
}

// MARK: - WKWebView wrapper

private struct WorkshopWebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var loadError: String?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = context.coordinator
        wv.backgroundColor = .clear
        wv.isOpaque = false
        wv.load(URLRequest(url: url))
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: WorkshopWebView
        init(_ parent: WorkshopWebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
            parent.loadError = nil
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            parent.loadError = error.localizedDescription
        }
    }
}
