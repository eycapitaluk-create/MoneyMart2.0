import SwiftUI

struct RootTabView: View {
    @State private var selectedTab: MMTab = .home

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HomeFeatureView { next in
                    selectedTab = next
                }
            }
            .tabItem { Label("ホーム", systemImage: "house.fill") }
            .tag(MMTab.home)

            NavigationStack { InvestFeatureView() }
                .tabItem { Label("投資", systemImage: "chart.bar.fill") }
                .tag(MMTab.invest)

            NavigationStack { NewsView() }
                .tabItem { Label("ニュース", systemImage: "newspaper") }
                .tag(MMTab.news)

            NavigationStack { ToolsFeatureView() }
                .tabItem { Label("ツール", systemImage: "wrench.and.screwdriver.fill") }
                .tag(MMTab.tools)

            NavigationStack { MyPageFeatureView() }
                .tabItem { Label("マイ", systemImage: "person.fill") }
                .tag(MMTab.mypage)
        }
        .tint(.orange)
    }
}

