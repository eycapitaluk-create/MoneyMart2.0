import SwiftUI
import Combine

struct ExpenseRow: Decodable, Identifiable {
    let id: String
    let userId: String
    let category: String?
    let amount: Double
    let paidAt: String?
    let note: String?
}

private struct ExpenseInsert: Encodable {
    let userId: String
    let category: String
    let amount: Double
    let paidAt: String
    let note: String
}

private final class BudgetRepository {
    private let client = SupabaseRESTClient()

    func fetchExpenses(userId: String) async throws -> [ExpenseRow] {
        try await client.select(
            table: "user_expenses",
            select: "id,user_id,category,amount,paid_at,note",
            filters: [URLQueryItem(name: "user_id", value: "eq.\(userId)")],
            order: "paid_at.desc",
            limit: 200
        )
    }

    func addExpense(userId: String, category: String, amount: Double, note: String) async throws {
        let date = ISO8601DateFormatter().string(from: Date()).prefix(10)
        let payload = ExpenseInsert(userId: userId, category: category, amount: amount, paidAt: String(date), note: note)
        try await client.insert(table: "user_expenses", row: payload)
    }
}

@MainActor
final class BudgetViewModel: ObservableObject {
    @Published var userId = ""
    @Published var category = "Food"
    @Published var amountText = ""
    @Published var note = ""
    @Published var rows: [ExpenseRow] = []
    @Published var loading = false
    @Published var errorMessage = ""

    private let repo = BudgetRepository()

    var totalMonth: Double {
        rows.reduce(0) { $0 + $1.amount }
    }

    func load() async {
        guard !userId.isEmpty else { return }
        loading = true
        errorMessage = ""
        do {
            rows = try await repo.fetchExpenses(userId: userId)
        } catch {
            rows = []
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    func add() async {
        guard !userId.isEmpty, let amount = Double(amountText), amount > 0 else { return }
        do {
            try await repo.addExpense(userId: userId, category: category, amount: amount, note: note)
            amountText = ""
            note = ""
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct BudgetView: View {
    @StateObject private var vm = BudgetViewModel()
    @AppStorage("mm_user_id") private var savedUserId = ""
    private let categories = ["Food", "Transport", "Housing", "Bills", "Leisure", "Other"]
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
                            Button("Load Expenses") { Task { await vm.load() } }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                }

                MMCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Add Expense").font(.headline)
                        Picker("Category", selection: $vm.category) {
                            ForEach(categories, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.menu)
                        .padding(10)
                        .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        TextField("Amount", text: $vm.amountText)
                            .keyboardType(.decimalPad)
                            .padding(10)
                            .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        TextField("Note", text: $vm.note)
                            .padding(10)
                            .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        Button("Save") { Task { await vm.add() } }
                            .buttonStyle(.borderedProminent)
                    }
                }

                MMCard {
                    HStack {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Monthly Total").font(.headline)
                            Text(vm.totalMonth, format: .currency(code: "USD")).font(.title2.bold())
                        }
                        Spacer()
                        MMBadge(text: "\(vm.rows.count) items", tint: .orange)
                    }
                }

                if vm.rows.isEmpty && !vm.loading {
                    MMCard {
                        MMEmptyState(
                            title: "支出データがありません",
                            subtitle: "user_id を保存して読み込みすると最近の支出が表示されます。",
                            symbol: "wallet.pass"
                        )
                    }
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(vm.rows) { row in
                            MMCard {
                                HStack {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(row.category ?? "Other").font(.headline)
                                        Text(row.note ?? "").font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 6) {
                                        Text(row.amount, format: .currency(code: "USD")).font(.headline)
                                        Text(row.paidAt ?? "").font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Budget")
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

