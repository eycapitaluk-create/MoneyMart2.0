import Foundation

private struct SupabaseErrorBody: Decodable {
    let code: String?
    let details: String?
    let hint: String?
    let message: String?
}

struct SupabaseRESTClient {
    let baseURL: URL
    let anonKey: String

    init(baseURL: URL = AppConfig.supabaseURL, anonKey: String = AppConfig.supabaseAnonKey) {
        self.baseURL = baseURL
        self.anonKey = anonKey
    }

    func select<T: Decodable>(
        table: String,
        select: String = "*",
        filters: [URLQueryItem] = [],
        order: String? = nil,
        limit: Int? = nil
    ) async throws -> [T] {
        var items = [URLQueryItem(name: "select", value: select)]
        items.append(contentsOf: filters)
        if let order { items.append(URLQueryItem(name: "order", value: order)) }
        if let limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }

        var comps = URLComponents(url: baseURL.appending(path: "/rest/v1/\(table)"), resolvingAgainstBaseURL: false)
        comps?.queryItems = items
        guard let url = comps?.url else { throw URLError(.badURL) }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200...299).contains(http.statusCode) else {
            let message: String
            if let parsed = try? JSONDecoder().decode(SupabaseErrorBody.self, from: data), let m = parsed.message, !m.isEmpty {
                message = m
            } else {
                message = String(data: data, encoding: .utf8) ?? "unknown"
            }
            throw NSError(
                domain: "SupabaseREST",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "Request failed (\(http.statusCode)): \(message)"]
            )
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode([T].self, from: data)
    }

    func insert<T: Encodable>(table: String, row: T) async throws {
        let url = baseURL.appending(path: "/rest/v1/\(table)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(row)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "SupabaseREST", code: (response as? HTTPURLResponse)?.statusCode ?? -1, userInfo: [NSLocalizedDescriptionKey: "Insert failed"])
        }
    }
}

