import SwiftUI
import Combine

/// Matches web `user_watchlists` (`SUPABASE_SETUP_MYPAGE_CORE` + stock ALTER): item_id / item_type / item_name — no legacy `symbol` column.
private struct WatchlistRow: Decodable, Identifiable {
    let id: String
    let userId: String
    let itemType: String
    let itemId: String
    let itemName: String?
}

/// Matches web `user_dividend_watchlist`: stock_id / stock_name — no `symbol`, no `target_date` column.
private struct DividendWatchRow: Decodable, Identifiable {
    let id: String
    let userId: String
    let stockId: String
    let stockName: String?
}

private struct SymbolRow: Decodable {
    let symbol: String
    let nameJp: String?
    let nameEn: String?
}

private struct StockSymbolRow: Decodable {
    let symbol: String
    let name: String?
}

struct WatchItem: Identifiable {
    let id: String
    let symbol: String
    let name: String
    let targetDate: String?
    let type: String
}

private final class WatchlistRepository {
    private let client = SupabaseRESTClient()

    func fetch(userId: String) async throws -> [WatchItem] {
        async let watchlistsTask: [WatchlistRow] = client.select(
            table: "user_watchlists",
            select: "id,user_id,item_type,item_id,item_name",
            filters: [URLQueryItem(name: "user_id", value: "eq.\(userId)")],
            limit: 300
        )
        async let dividendsTask: [DividendWatchRow] = client.select(
            table: "user_dividend_watchlist",
            select: "id,user_id,stock_id,stock_name",
            filters: [URLQueryItem(name: "user_id", value: "eq.\(userId)")],
            order: "updated_at.desc",
            limit: 300
        )
        async let symbolsTask: [SymbolRow] = client.select(
            table: "stock_symbol_profiles",
            select: "symbol,name_jp,name_en",
            limit: 2000
        )
        async let stockSymbolsTask: [StockSymbolRow] = client.select(
            table: "stock_symbols",
            select: "symbol,name",
            limit: 2500
        )

        let watchlists = try await watchlistsTask
        let dividends = try await dividendsTask
        let symbols = try await symbolsTask
        let stockSymbols = try await stockSymbolsTask
        let profileMap = Dictionary(uniqueKeysWithValues: symbols.map { ($0.symbol.uppercased(), $0) })
        let stockSymbolMap = Dictionary(uniqueKeysWithValues: stockSymbols.map { ($0.symbol.uppercased(), $0) })

        var nameMap: [String: String] = [:]
        func cacheDisplayKey(_ raw: String, fallbackName: String?) {
            let key = raw.uppercased()
            if nameMap[key] != nil { return }
            let resolved = profileMap[key]?.nameJp ?? profileMap[key]?.nameEn ?? stockSymbolMap[key]?.name ?? fallbackName ?? raw
            nameMap[key] = resolved
        }
        for row in watchlists {
            let code = String(row.itemId).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !code.isEmpty else { continue }
            cacheDisplayKey(code, fallbackName: row.itemName)
        }
        for row in dividends {
            let code = String(row.stockId).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !code.isEmpty else { continue }
            cacheDisplayKey(code, fallbackName: row.stockName)
        }

        let a = watchlists.compactMap { row -> WatchItem? in
            let kind = String(row.itemType).lowercased()
            let code = String(row.itemId).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !code.isEmpty else { return nil }
            let upper = code.uppercased()
            let trimmedMeta = row.itemName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let defaultName = trimmedMeta.isEmpty ? code : trimmedMeta
            let displayName: String
            let badge: String
            switch kind {
            case "stock":
                displayName = nameMap[upper] ?? defaultName
                badge = "株式WL"
            case "fund":
                displayName = defaultName
                badge = "ファンドWL"
            case "product":
                displayName = defaultName
                badge = "商品関心"
            default:
                displayName = defaultName
                badge = "WL"
            }
            return WatchItem(
                id: "wl-\(row.id)",
                symbol: code,
                name: displayName,
                targetDate: nil,
                type: badge
            )
        }
        let b = dividends.map {
            let code = String($0.stockId).trimmingCharacters(in: .whitespacesAndNewlines)
            let upper = code.uppercased()
            let meta = $0.stockName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let fallback = meta.isEmpty ? code : meta
            return WatchItem(
                id: "dv-\($0.id)",
                symbol: code,
                name: nameMap[upper] ?? fallback,
                targetDate: nil,
                type: "配当カレンダー"
            )
        }
        return (a + b).sorted { $0.symbol < $1.symbol }
    }
}

@MainActor
final class WatchlistDividendViewModel: ObservableObject {
    @Published var userId = ""
    @Published var rows: [WatchItem] = []
    @Published var loading = false
    @Published var errorMessage = ""

    private let repo = WatchlistRepository()

    func load() async {
        guard !userId.isEmpty else { return }
        loading = true
        errorMessage = ""
        do {
            rows = try await repo.fetch(userId: userId)
        } catch {
            rows = []
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

struct WatchlistDividendView: View {
    @StateObject private var vm = WatchlistDividendViewModel()
    @AppStorage("mm_user_id") private var savedUserId = ""
    private var showError: Binding<Bool> {
        Binding(
            get: { !vm.errorMessage.isEmpty },
            set: { if !$0 { vm.errorMessage = "" } }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                MMCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("User ID").font(.headline)
                        TextField("Supabase user_id", text: $vm.userId)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(10)
                            .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        HStack {
                            Button("保存") { savedUserId = vm.userId.trimmingCharacters(in: .whitespacesAndNewlines) }
                                .buttonStyle(.bordered)
                            Button("Load Watchlist") { Task { await vm.load() } }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                }

                MMCard {
                    HStack {
                        Text("Items").font(.headline)
                        Spacer()
                        MMBadge(text: "\(vm.rows.count)", tint: .orange)
                    }
                }

                if vm.rows.isEmpty && !vm.loading {
                    MMCard {
                        MMEmptyState(
                            title: "ウォッチリストが空です",
                            subtitle: "保存した user_id で読み込むと表示されます。",
                            symbol: "star.slash"
                        )
                    }
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(vm.rows) { row in
                            MMCard {
                                HStack {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(row.symbol).font(.headline)
                                        Text(row.name).font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 6) {
                                        MMBadge(text: row.type, tint: row.type.contains("配当") ? .green : .blue)
                                        if let target = row.targetDate, !target.isEmpty {
                                            Text(target).font(.caption2).foregroundStyle(.secondary)
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
        .navigationTitle("Watchlist")
        .task {
            if vm.userId.isEmpty, !savedUserId.isEmpty {
                vm.userId = savedUserId
                await vm.load()
            }
        }
        .overlay { if vm.loading { ProgressView("読み込み中...") } }
        .alert("エラー", isPresented: showError) {
            Button("OK") { vm.errorMessage = "" }
        } message: { Text(vm.errorMessage) }
    }
}

