import SwiftUI
import Combine

private struct StockLatestRow: Decodable {
    let symbol: String
    let close: Double?
}

private struct StockProfileRow: Decodable {
    let symbol: String
    let nameJp: String?
    let nameEn: String?
}

private struct StockSymbolRow: Decodable {
    let symbol: String
    let name: String?
}

struct StockItem: Identifiable {
    let id: String
    let symbol: String
    let name: String
    let close: Double?
}

private final class StocksRepository {
    private let client = SupabaseRESTClient()

    func fetchTopStocks() async throws -> [StockItem] {
        async let latestTask: [StockLatestRow] = client.select(
            table: "v_stock_latest",
            select: "symbol,close",
            order: "symbol.asc",
            limit: 200
        )
        async let profilesTask: [StockProfileRow] = client.select(
            table: "stock_symbol_profiles",
            select: "symbol,name_jp,name_en",
            order: "symbol.asc",
            limit: 500
        )
        async let symbolsTask: [StockSymbolRow] = client.select(
            table: "stock_symbols",
            select: "symbol,name",
            order: "symbol.asc",
            limit: 1500
        )

        let latest = try await latestTask
        let profiles = try await profilesTask
        let symbols = try await symbolsTask
        let profileMap = Dictionary(uniqueKeysWithValues: profiles.map { ($0.symbol.uppercased(), $0) })
        let symbolMap = Dictionary(uniqueKeysWithValues: symbols.map { ($0.symbol.uppercased(), $0) })

        return latest.map { row in
            let p = profileMap[row.symbol.uppercased()]
            let s = symbolMap[row.symbol.uppercased()]
            let name = p?.nameJp ?? p?.nameEn ?? s?.name ?? row.symbol
            return StockItem(id: row.symbol, symbol: row.symbol, name: name, close: row.close)
        }
    }
}

@MainActor
final class StocksViewModel: ObservableObject {
    @Published var query = ""
    @Published var rows: [StockItem] = []
    @Published var loading = false
    @Published var errorMessage = ""

    private let repo = StocksRepository()

    var filtered: [StockItem] {
        guard !query.isEmpty else { return rows }
        return rows.filter {
            $0.symbol.localizedCaseInsensitiveContains(query) ||
            $0.name.localizedCaseInsensitiveContains(query)
        }
    }

    func load() async {
        loading = true
        errorMessage = ""
        do {
            rows = try await repo.fetchTopStocks()
        } catch {
            rows = []
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

struct StocksView: View {
    @StateObject private var vm = StocksViewModel()
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
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Stocks").font(.title3.bold())
                            Text("実データ: v_stock_latest").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        MMBadge(text: "\(vm.rows.count) symbols", tint: .orange)
                    }
                }

                if vm.filtered.isEmpty && !vm.loading {
                    MMCard {
                        MMEmptyState(
                            title: "株式データがありません",
                            subtitle: "検索条件を変更するか、Supabaseデータ状態を確認してください。",
                            symbol: "chart.line.downtrend.xyaxis"
                        )
                    }
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(vm.filtered) { row in
                            MMCard {
                                HStack {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(row.symbol).font(.headline)
                                        Text(row.name).font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                    Spacer()
                                    if let close = row.close {
                                        Text(close, format: .number.precision(.fractionLength(2)))
                                            .font(.title3.bold())
                                    } else {
                                        Text("-").foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Stocks")
        .searchable(text: $vm.query, prompt: "Symbol / Name")
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .overlay { if vm.loading { ProgressView("読み込み中...") } }
        .alert("エラー", isPresented: showError) {
            Button("OK") { vm.errorMessage = "" }
        } message: { Text(vm.errorMessage) }
    }
}

