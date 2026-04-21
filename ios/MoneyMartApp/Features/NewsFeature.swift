import SwiftUI
import Combine

private struct ManualNewsRow: Decodable, Identifiable {
    let id: Int
    let bucket: String?
    let title: String?
    let description: String?
    let publishedAt: String?
    let source: String?
    let topic: String?
    let timeText: String?
    let url: String?
    let imageUrl: String?
}

private struct AiNewsRow: Decodable, Identifiable {
    let id: Int
    let title: String?
    let summary: String?
    let publishedAt: String?
    let source: String?
}

struct NewsItem: Identifiable {
    let id: String
    let title: String
    let body: String
    let source: String
    let publishedAt: String
    let topic: String
    let url: String
    let imageUrl: String
    let bucket: String
}

enum NewsFilter: String, CaseIterable, Identifiable {
    case all = "全て"
    case market = "マーケット"
    case fund = "ファンド"
    case alert = "速報"

    var id: String { rawValue }
}

private final class NewsRepository {
    private let client = SupabaseRESTClient()

    func fetchTopNews() async throws -> [NewsItem] {
        let manual: [ManualNewsRow] = try await client.select(
            table: "news_manual",
            select: "id,bucket,title,description,published_at,source,topic,time_text,url,image_url",
            filters: [
                URLQueryItem(name: "is_active", value: "eq.true"),
                URLQueryItem(name: "bucket", value: "in.(market_ticker,market_pickup,fund_pickup,stock_disclosures,market_major_event,market_weekly_summary)")
            ],
            order: "sort_order.asc,published_at.desc",
            limit: 80
        )

        if !manual.isEmpty {
            return manual.compactMap {
                guard let title = $0.title else { return nil }
                return NewsItem(
                    id: "manual-\($0.id)",
                    title: title,
                    body: $0.description ?? "",
                    source: $0.source ?? "MoneyMart",
                    publishedAt: $0.timeText ?? $0.publishedAt ?? "",
                    topic: $0.topic ?? inferTopic(bucket: $0.bucket),
                    url: $0.url ?? "",
                    imageUrl: $0.imageUrl ?? "",
                    bucket: $0.bucket ?? ""
                )
            }
        }

        let ai: [AiNewsRow] = try await client.select(
            table: "ai_news_summaries",
            select: "id,title,summary,published_at,source",
            order: "published_at.desc",
            limit: 20
        )
        return ai.compactMap {
            guard let title = $0.title, let summary = $0.summary else { return nil }
            return NewsItem(
                id: "ai-\($0.id)",
                title: title,
                body: summary,
                source: $0.source ?? "AI Summary",
                publishedAt: $0.publishedAt ?? "",
                topic: "マーケット",
                url: "",
                imageUrl: "",
                bucket: "ai_news"
            )
        }
    }

    private func inferTopic(bucket: String?) -> String {
        switch bucket {
        case "fund_pickup": return "ファンド"
        case "stock_disclosures": return "速報"
        case "market_ticker", "market_pickup", "market_major_event", "market_weekly_summary": return "マーケット"
        default: return "ニュース"
        }
    }
}

@MainActor
final class NewsViewModel: ObservableObject {
    @Published var rows: [NewsItem] = []
    @Published var loading = false
    @Published var errorMessage = ""
    @Published var filter: NewsFilter = .all

    private let repo = NewsRepository()

    var filteredRows: [NewsItem] {
        switch filter {
        case .all: return rows
        case .market:
            return rows.filter { $0.topic.contains("マーケット") || $0.bucket.contains("market") }
        case .fund:
            return rows.filter { $0.topic.contains("ファンド") || $0.bucket == "fund_pickup" }
        case .alert:
            return rows.filter { $0.topic.contains("速報") || $0.bucket == "stock_disclosures" }
        }
    }

    func load() async {
        loading = true
        errorMessage = ""
        do {
            rows = try await repo.fetchTopNews()
        } catch {
            rows = []
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

struct NewsView: View {
    @StateObject private var vm = NewsViewModel()
    @Environment(\.openURL) private var openURL

    private var showError: Binding<Bool> {
        Binding(
            get: { !vm.errorMessage.isEmpty },
            set: { if !$0 { vm.errorMessage = "" } }
        )
    }

    private func topicColor(_ topic: String) -> Color {
        if topic.contains("速報") { return .red }
        if topic.contains("ファンド") { return .green }
        return .blue
    }

    private func displayTime(_ value: String) -> String {
        if value.contains(":") && value.count <= 5 { return value }
        let iso = ISO8601DateFormatter()
        if let date = iso.date(from: value) {
            let f = RelativeDateTimeFormatter()
            f.unitsStyle = .short
            f.locale = Locale(identifier: "ja_JP")
            return f.localizedString(for: date, relativeTo: Date())
        }
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd HH:mm:ssZ"
        if let date = input.date(from: value) {
            let f = RelativeDateTimeFormatter()
            f.unitsStyle = .short
            f.locale = Locale(identifier: "ja_JP")
            return f.localizedString(for: date, relativeTo: Date())
        }
        return value
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                MMCard {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("ニュース").font(.title3.bold())
                            Text("manual優先 / AI fallback").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        MMBadge(text: "\(vm.filteredRows.count) items", tint: .orange)
                    }
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(NewsFilter.allCases) { item in
                            Button {
                                vm.filter = item
                            } label: {
                                Text(item.rawValue)
                                    .font(.subheadline.bold())
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(
                                        item == vm.filter ? Color.orange : Color(.secondarySystemBackground),
                                        in: Capsule()
                                    )
                                    .foregroundStyle(item == vm.filter ? .white : .primary)
                            }
                        }
                    }
                }

                if vm.rows.isEmpty && !vm.loading {
                    MMCard {
                        MMEmptyState(
                            title: "ニュースがありません",
                            subtitle: "news_manual または ai_news_summaries データを確認してください。",
                            symbol: "newspaper"
                        )
                    }
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(vm.filteredRows) { row in
                            MMCard {
                                HStack(alignment: .top, spacing: 10) {
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            MMBadge(text: row.topic, tint: topicColor(row.topic))
                                            Spacer()
                                            Text(displayTime(row.publishedAt)).font(.caption2).foregroundStyle(.secondary)
                                        }
                                        Text(row.title).font(.headline).lineLimit(3)
                                        if !row.body.isEmpty {
                                            Text(row.body).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                                        }
                                        HStack {
                                            Text(row.source).font(.caption).foregroundStyle(.secondary)
                                            Spacer()
                                            if !row.url.isEmpty {
                                                Button("原文") {
                                                    guard let url = URL(string: row.url) else { return }
                                                    openURL(url)
                                                }
                                                .font(.caption.bold())
                                                .buttonStyle(.bordered)
                                            }
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)

                                    if let imageURL = URL(string: row.imageUrl), !row.imageUrl.isEmpty {
                                        AsyncImage(url: imageURL) { phase in
                                            switch phase {
                                            case .success(let image):
                                                image
                                                    .resizable()
                                                    .scaledToFill()
                                            case .failure:
                                                Image(systemName: "newspaper.fill")
                                                    .resizable()
                                                    .scaledToFit()
                                                    .padding(16)
                                                    .foregroundStyle(.secondary)
                                                    .background(Color(.tertiarySystemBackground))
                                            default:
                                                ProgressView()
                                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                                    .background(Color(.tertiarySystemBackground))
                                            }
                                        }
                                        .frame(width: 86, height: 86)
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                    } else {
                                        RoundedRectangle(cornerRadius: 12)
                                            .fill(Color(.tertiarySystemBackground))
                                            .frame(width: 86, height: 86)
                                            .overlay {
                                                Image(systemName: "newspaper.fill")
                                                    .font(.title3)
                                                    .foregroundStyle(.secondary)
                                            }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("News")
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .overlay { if vm.loading { ProgressView("読み込み中...") } }
        .alert("エラー", isPresented: showError) {
            Button("OK") { vm.errorMessage = "" }
        } message: { Text(vm.errorMessage) }
    }
}

