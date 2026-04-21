import SwiftUI
import Combine

private struct LatestPriceRow: Decodable {
    let symbol: String
    let tradeDate: String?
    let close: Double?
}

private struct HistoryPriceRow: Decodable {
    let symbol: String
    let tradeDate: String?
    let close: Double?
}

struct HeatmapTile: Identifiable {
    let id: String
    let name: String
    let changePct: Double
}

private enum HeatmapPalette {
    static func color(for change: Double) -> Color {
        switch change {
        case 2...: return Color.green.opacity(0.95)
        case 1..<2: return Color.green.opacity(0.8)
        case 0..<1: return Color.green.opacity(0.65)
        case -1..<0: return Color.red.opacity(0.55)
        case -2..<(-1): return Color.red.opacity(0.75)
        default: return Color.red.opacity(0.9)
        }
    }
}

private final class MarketRepository {
    private let client = SupabaseRESTClient()

    private let sectorSymbols: [(String, String)] = [
        ("IYE", "エネルギー"), ("IYM", "素材"), ("IYJ", "資本財・産業"),
        ("IYC", "一般消費財"), ("IYK", "生活必需品"), ("IYH", "ヘルスケア"),
        ("IYF", "金融"), ("IYW", "情報技術"), ("IYZ", "通信サービス"),
        ("IDU", "公益事業"), ("IYR", "不動産")
    ]

    private let regionSymbols: [(String, String)] = [
        ("ACWI", "全世界株式市場"), ("MCHI", "中国株式市場"), ("1329.T", "日本株式市場(日経225)"),
        ("1475.T", "日本株式市場"), ("AAXJ", "アジア(除く日本)株式市場"),
        ("EEM", "新興国株式市場"), ("IVV", "米国大型株市場"), ("IJH", "米国中型株市場"), ("IJR", "米国小型株市場")
    ]

    func fetchHeatmaps() async throws -> (sectors: [HeatmapTile], regions: [HeatmapTile]) {
        let symbols = Array(Set((sectorSymbols + regionSymbols).map { $0.0 }))
        let fromDate = Calendar.current.date(byAdding: .day, value: -10, to: Date()) ?? Date()
        let fromText = ISO8601DateFormatter().string(from: fromDate).prefix(10)

        let latest: [LatestPriceRow] = try await client.select(
            table: "v_stock_latest",
            select: "symbol,trade_date,close",
            filters: [URLQueryItem(name: "symbol", value: "in.(\(symbols.joined(separator: ",")))")]
        )
        let history: [HistoryPriceRow] = try await client.select(
            table: "stock_daily_prices",
            select: "symbol,trade_date,close",
            filters: [
                URLQueryItem(name: "symbol", value: "in.(\(symbols.joined(separator: ",")))"),
                URLQueryItem(name: "trade_date", value: "gte.\(fromText)")
            ],
            order: "trade_date.desc"
        )

        let latestMap = Dictionary(uniqueKeysWithValues: latest.map { ($0.symbol.uppercased(), $0) })
        let grouped = Dictionary(grouping: history, by: { $0.symbol.uppercased() })

        func prevClose(for symbol: String, latestDate: String?) -> Double? {
            guard let latestDate else { return nil }
            let rows = grouped[symbol.uppercased()] ?? []
            return rows.first(where: { ($0.tradeDate ?? "") < latestDate })?.close
        }

        func makeTiles(_ source: [(String, String)]) -> [HeatmapTile] {
            source.compactMap { symbol, name in
                guard
                    let live = latestMap[symbol.uppercased()],
                    let close = live.close,
                    let prev = prevClose(for: symbol, latestDate: live.tradeDate),
                    prev > 0
                else { return nil }
                let change = ((close - prev) / prev) * 100
                return HeatmapTile(id: symbol, name: name, changePct: change)
            }
        }

        return (makeTiles(sectorSymbols), makeTiles(regionSymbols))
    }
}

@MainActor
final class MarketViewModel: ObservableObject {
    @Published var sectors: [HeatmapTile] = []
    @Published var regions: [HeatmapTile] = []
    @Published var loading = false
    @Published var errorMessage = ""

    private let repo = MarketRepository()

    func load() async {
        loading = true
        errorMessage = ""
        do {
            let data = try await repo.fetchHeatmaps()
            sectors = data.sectors
            regions = data.regions
        } catch {
            sectors = []
            regions = []
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

struct MarketView: View {
    @StateObject private var vm = MarketViewModel()
    private var showError: Binding<Bool> {
        Binding(
            get: { !vm.errorMessage.isEmpty },
            set: { if !$0 { vm.errorMessage = "" } }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                MMCard {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Heatmap").font(.title3.bold())
                            Text("前日比で自動計算").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        MMBadge(text: "\(vm.sectors.count + vm.regions.count) tiles", tint: .orange)
                    }
                }
                heatmapSection(title: "セクターヒートマップ", rows: vm.sectors)
                heatmapSection(title: "国家別ヒートマップ", rows: vm.regions)
            }
            .padding()
        }
        .navigationTitle("Market")
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .overlay {
            if vm.loading { ProgressView("読み込み中...") }
        }
        .alert("エラー", isPresented: showError) {
            Button("OK") { vm.errorMessage = "" }
        } message: {
            Text(vm.errorMessage)
        }
    }

    @ViewBuilder
    private func heatmapSection(title: String, rows: [HeatmapTile]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            if rows.isEmpty && !vm.loading {
                MMEmptyState(
                    title: "データがありません",
                    subtitle: "対象シンボルの最新値と前日終値が揃うと表示されます。",
                    symbol: "square.grid.3x3.middle.filled"
                )
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(rows) { tile in
                        VStack(spacing: 6) {
                            Text(tile.name).font(.caption).bold().multilineTextAlignment(.center).lineLimit(2)
                            Text("\(tile.changePct >= 0 ? "+" : "")\(tile.changePct, specifier: "%.1f")%")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity, minHeight: 86)
                        .padding(8)
                        .background(HeatmapPalette.color(for: tile.changePct))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

