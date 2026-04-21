import SwiftUI
import Combine

private struct WatchlistRow: Decodable, Identifiable {
    let id: String
    let userId: String
    let symbol: String
}

private struct DividendWatchRow: Decodable, Identifiable {
    let id: String
    let userId: String
    let symbol: String
    let targetDate: String?
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
            select: "id,user_id,symbol",
            filters: [URLQueryItem(name: "user_id", value: "eq.\(userId)")],
            limit: 300
        )
        async let dividendsTask: [DividendWatchRow] = client.select(
            table: "user_dividend_watchlist",
            select: "id,user_id,symbol,target_date",
            filters: [URLQueryItem(name: "user_id", value: "eq.\(userId)")],
            order: "target_date.asc",
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
        for symbol in (watchlists.map(\.symbol) + dividends.map(\.symbol)) {
            let key = symbol.uppercased()
            if nameMap[key] == nil {
                nameMap[key] = profileMap[key]?.nameJp ?? profileMap[key]?.nameEn ?? stockSymbolMap[key]?.name ?? symbol
            }
        }

        let a = watchlists.map {
            WatchItem(
                id: "wl-\($0.id)",
                symbol: $0.symbol,
                name: nameMap[$0.symbol.uppercased()] ?? $0.symbol,
                targetDate: nil,
                type: "Watchlist"
            )
        }
        let b = dividends.map {
            WatchItem(
                id: "dv-\($0.id)",
                symbol: $0.symbol,
                name: nameMap[$0.symbol.uppercased()] ?? $0.symbol,
                targetDate: $0.targetDate,
                type: "Dividend"
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
                                        MMBadge(text: row.type, tint: row.type == "Dividend" ? .green : .blue)
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

