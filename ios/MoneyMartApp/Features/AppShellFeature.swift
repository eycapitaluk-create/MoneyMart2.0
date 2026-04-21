import SwiftUI

enum MMTab: Hashable {
    case home
    case invest
    case news
    case tools
    case mypage
}

struct HomeFeatureView: View {
    let moveToTab: (MMTab) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                LinearGradient(colors: [Color(red: 0.07, green: 0.14, blue: 0.31), Color(red: 0.09, green: 0.22, blue: 0.44)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .overlay(alignment: .topLeading) {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Label("MoneyMart", systemImage: "m.circle.fill")
                                    .font(.title2.bold())
                                    .foregroundStyle(.white)
                                Spacer()
                                MMBadge(text: "#新NISA", tint: .orange)
                            }
                            Text("投資家さん")
                                .font(.largeTitle.bold())
                                .foregroundStyle(.white)
                            Text("ファンドを追加してポートフォリオを始めましょう")
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.8))
                        }
                        .padding(16)
                    }
                    .frame(height: 210)
                    .clipShape(RoundedRectangle(cornerRadius: 20))

                MMCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("クイックアクション").font(.headline)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            quickButton("投資", "chart.bar.fill", .orange) { moveToTab(.invest) }
                            quickButton("ニュース", "newspaper.fill", .blue) { moveToTab(.news) }
                            quickButton("家計簿", "wallet.pass.fill", .green) { moveToTab(.tools) }
                            quickButton("マイページ", "person.fill", .purple) { moveToTab(.mypage) }
                        }
                    }
                }

                MMCard {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("マーケット速報").font(.headline)
                            Text("リアルタイム反映").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        NavigationLink("ヒートマップ") { MarketView() }
                            .font(.subheadline.bold())
                    }
                }
            }
            .padding()
        }
        .navigationTitle("ホーム")
    }

    private func quickButton(_ title: String, _ icon: String, _ color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon).font(.title3).foregroundStyle(color)
                Text(title).font(.subheadline.bold()).foregroundStyle(.primary)
            }
            .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
            .padding(10)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }
}

struct InvestFeatureView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                MMCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("投資ハブ").font(.title3.bold())
                        Text("市場・株式・監視リストをここから確認できます").font(.footnote).foregroundStyle(.secondary)
                    }
                }

                NavigationLink {
                    MarketView()
                } label: {
                    MMCard {
                        HStack {
                            Label("ヒートマップ", systemImage: "square.grid.3x3.fill")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                    }
                }
                .buttonStyle(.plain)

                NavigationLink {
                    StocksView()
                } label: {
                    MMCard {
                        HStack {
                            Label("株式一覧", systemImage: "building.columns.fill")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                    }
                }
                .buttonStyle(.plain)

                NavigationLink {
                    WatchlistDividendView()
                } label: {
                    MMCard {
                        HStack {
                            Label("配当カレンダー / 監視銘柄", systemImage: "star.circle.fill")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .padding()
        }
        .navigationTitle("投資")
    }
}

struct ToolsFeatureView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                MMCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("投資計算ツール").font(.title3.bold())
                        Text("実データは含まず、計算結果は参考値です。").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                NavigationLink {
                    BudgetView()
                } label: {
                    MMCard {
                        HStack {
                            Label("家計簿", systemImage: "wallet.pass.fill")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                    }
                }
                .buttonStyle(.plain)
                NavigationLink {
                    WatchlistDividendView()
                } label: {
                    MMCard {
                        HStack {
                            Label("配当カレンダー / 監視銘柄", systemImage: "calendar.badge.plus")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .padding()
        }
        .navigationTitle("ツール")
    }
}

struct MyPageFeatureView: View {
    @AppStorage("mm_user_id") private var userId = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                MMCard {
                    HStack(spacing: 12) {
                        Circle().fill(Color.orange).frame(width: 44, height: 44).overlay {
                            Text("U").foregroundStyle(.white).bold()
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("ユーザー").font(.headline)
                            Text(userId.isEmpty ? "未ログイン / user_id未設定" : userId).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                MMCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("資産").font(.headline)
                        Text("¥0").font(.largeTitle.bold())
                        Text("データ精度優先: 値が無い場合は推定を表示しません").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("マイページ")
    }
}

