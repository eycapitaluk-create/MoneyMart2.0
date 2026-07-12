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

private enum HeatmapMode: String, CaseIterable, Identifiable {
    case sector = "セクター別"
    case region = "国家/地域別"

    var id: String { rawValue }
}

private enum HeatmapPalette {
    static func color(for change: Double) -> Color {
        switch change {
        case 2...: return Color(red: 0.05, green: 0.55, blue: 0.25)
        case 1..<2: return Color(red: 0.15, green: 0.65, blue: 0.35)
        case 0..<1: return Color(red: 0.35, green: 0.75, blue: 0.45)
        case -1..<0: return Color(red: 0.95, green: 0.45, blue: 0.45)
        case -2..<(-1): return Color(red: 0.85, green: 0.25, blue: 0.25)
        default: return Color(red: 0.15, green: 0.25, blue: 0.75)
        }
    }

    static let legend: [(String, Color)] = [
        ("≥+2%", Color(red: 0.05, green: 0.55, blue: 0.25)),
        ("+1%", Color(red: 0.15, green: 0.65, blue: 0.35)),
        ("0%", Color(red: 0.35, green: 0.75, blue: 0.45)),
        ("-1%", Color(red: 0.95, green: 0.45, blue: 0.45)),
        ("-2%", Color(red: 0.85, green: 0.25, blue: 0.25)),
        ("≤-2%", Color(red: 0.15, green: 0.25, blue: 0.75)),
    ]
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

    private func isoDateDaysAgo(_ days: Int) -> String {
        let date = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func fetchTiles(for source: [(String, String)]) async throws -> ([HeatmapTile], String?) {
        let symbols = source.map(\.0)
        let fromText = isoDateDaysAgo(10)
        let symbolFilter = URLQueryItem(name: "symbol", value: SupabaseRESTClient.inFilter(symbols))

        let latest: [LatestPriceRow] = try await client.select(
            table: "v_stock_latest",
            select: "symbol,trade_date,close",
            filters: [symbolFilter]
        )
        let history: [HistoryPriceRow] = try await client.select(
            table: "stock_daily_prices",
            select: "symbol,trade_date,close",
            filters: [
                symbolFilter,
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

        let tiles = source.compactMap { symbol, name -> HeatmapTile? in
            guard
                let live = latestMap[symbol.uppercased()],
                let close = live.close,
                let prev = prevClose(for: symbol, latestDate: live.tradeDate),
                prev > 0
            else { return nil }
            let change = ((close - prev) / prev) * 100
            return HeatmapTile(id: symbol, name: name, changePct: change)
        }

        let latestDate = latest
            .compactMap(\.tradeDate)
            .sorted()
            .last

        return (tiles, latestDate)
    }

    func fetchHeatmaps() async throws -> (sectors: [HeatmapTile], regions: [HeatmapTile], dataDate: String?) {
        async let sectorTask = fetchTiles(for: sectorSymbols)
        async let regionTask = fetchTiles(for: regionSymbols)
        let sectorResult = try await sectorTask
        let regionResult = try await regionTask
        let dataDate = [sectorResult.1, regionResult.1].compactMap { $0 }.sorted().last
        return (sectorResult.0, regionResult.0, dataDate)
    }
}

@MainActor
final class MarketViewModel: ObservableObject {
    @Published var sectors: [HeatmapTile] = []
    @Published var regions: [HeatmapTile] = []
    @Published var dataDate = ""
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
            dataDate = data.dataDate ?? ""
        } catch {
            sectors = []
            regions = []
            dataDate = ""
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

struct MarketView: View {
    @StateObject private var vm = MarketViewModel()
    @State private var mode: HeatmapMode = .sector

    private var activeRows: [HeatmapTile] {
        mode == .sector ? vm.sectors : vm.regions
    }

    private var showError: Binding<Bool> {
        Binding(
            get: { !vm.errorMessage.isEmpty },
            set: { if !$0 { vm.errorMessage = "" } }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                modePicker
                heatmapCard
                colorGuide
            }
            .padding()
        }
        .navigationTitle("マーケット")
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

    private var modePicker: some View {
        HStack(spacing: 0) {
            ForEach(HeatmapMode.allCases) { item in
                Button {
                    mode = item
                } label: {
                    Text(item.rawValue)
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(mode == item ? Color.orange.opacity(0.15) : Color.clear)
                        .foregroundStyle(mode == item ? Color.orange : Color.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private var heatmapCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(mode == .sector ? "セクター別 当日騰落率" : "国家/地域別 当日騰落率")
                        .font(.headline)
                    if !vm.dataDate.isEmpty {
                        Text(vm.dataDate)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text("\(activeRows.count) ETFs")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.orange.opacity(0.12), in: Capsule())
            }

            if activeRows.isEmpty && !vm.loading {
                MMEmptyState(
                    title: "データなし",
                    subtitle: "価格データが見つかりませんでした",
                    symbol: "chart.bar"
                )
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(activeRows) { tile in
                        VStack(spacing: 6) {
                            Text(tile.name)
                                .font(.caption)
                                .bold()
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
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

    private var colorGuide: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("カラーガイド")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            HStack(spacing: 6) {
                ForEach(HeatmapPalette.legend, id: \.0) { label, color in
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(color)
                            .frame(height: 10)
                        Text(label)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.horizontal, 4)
    }
}
