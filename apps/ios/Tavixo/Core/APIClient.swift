import Foundation

enum APIError: Error, LocalizedError {
    case conflict, invalidInput, contextChanged
    case unauthorized, forbidden, credentials, rateLimited, server, network, invalidResponse, storage, insecureURL
    var errorDescription: String? {
        switch self {
        case .conflict: "La cuenta o la mesa cambió. Actualiza y revisa antes de enviar de nuevo."
        case .invalidInput: "Revisa el pedido: algún producto puede estar agotado, inactivo o fuera de los límites permitidos."
        case .contextChanged: "Cambió tu acceso. Abre de nuevo el pedido con la sesión actual."
        case .unauthorized: "La sesión terminó. Vuelve a iniciar sesión."
        case .forbidden: "Tu cuenta no tiene permiso para esta operación."
        case .credentials: "Revisa tu restaurante, correo y contraseña."
        case .rateLimited: "Demasiados intentos. Espera un minuto y vuelve a intentar."
        case .server: "El servicio no está disponible. Intenta de nuevo."
        case .network: "No se pudo conectar. Revisa tu conexión y vuelve a intentar."
        case .invalidResponse: "No se pudo interpretar la respuesta de Tavixo."
        case .storage: "No se pudo acceder al llavero seguro del dispositivo."
        case .insecureURL: "La conexión debe utilizar HTTPS."
        }
    }
}

private final class RefuseRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

@MainActor final class APIClient {
    static let productionURL = URL(string:"https://tavixo.nut.com.mx")!
    let baseURL: URL
    private let transport: URLSession
    private let secrets: SecretStore
    private(set) var session: SessionPayload?
    private var expiry = Date.distantPast
    private var refreshTask: Task<SessionPayload, Error>?
    var onSessionChange: ((SessionPayload?) -> Void)?

    init(baseURL: URL = productionURL, secrets: SecretStore = KeychainStore(), configuration: URLSessionConfiguration? = nil) {
        self.baseURL = baseURL; self.secrets = secrets
        let config = configuration ?? URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false; config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 20; config.timeoutIntervalForResource = 30
        self.transport = URLSession(configuration: config, delegate: RefuseRedirects(), delegateQueue: nil)
    }
    func hasSavedSession() throws -> Bool { try secrets.read() != nil }
    private func request(_ path: String, method: String = "GET", body: Data? = nil, token: String? = nil, cookie: String? = nil) throws -> URLRequest {
        guard baseURL.scheme == "https", let host = baseURL.host, baseURL.user == nil, baseURL.password == nil,
              baseURL.path.isEmpty || baseURL.path == "/" else { throw APIError.insecureURL }
        var r = URLRequest(url:baseURL.appendingPathComponent("api/" + path))
        r.httpMethod = method; r.httpBody = body; r.cachePolicy = .reloadIgnoringLocalCacheData
        r.setValue("application/json", forHTTPHeaderField:"Accept")
        r.setValue("no-store", forHTTPHeaderField:"Cache-Control")
        if body != nil { r.setValue("application/json", forHTTPHeaderField:"Content-Type") }
        // Existing API checks its web origin on authentication endpoints; no server changes.
        let port = baseURL.port.map { ":\($0)" } ?? ""
        r.setValue("https://\(host)\(port)", forHTTPHeaderField:"Origin")
        if let token { r.setValue("Bearer \(token)", forHTTPHeaderField:"Authorization") }
        if let cookie {
            guard cookie.range(of:"^[A-Za-z0-9_-]{1,256}$",options:.regularExpression) != nil else { throw APIError.invalidResponse }
            r.setValue("tavixo_refresh=\(cookie)", forHTTPHeaderField:"Cookie")
        }
        r.httpShouldHandleCookies = false
        return r
    }
    private func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await transport.data(for:request)
            guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            // Redirects are refused by the transport; also validate the response origin.
            guard http.url?.scheme == baseURL.scheme, http.url?.host == baseURL.host, http.url?.port == baseURL.port else { throw APIError.invalidResponse }
            return (data, http)
        } catch is URLError { throw APIError.network }
    }
    private func check(_ response: HTTPURLResponse, login: Bool = false) throws {
        switch response.statusCode {
        case 200..<300: return
        case 400 where login: throw APIError.credentials
        case 401: throw login ? APIError.credentials : APIError.unauthorized
        case 400, 404, 422: throw APIError.invalidInput
        case 409: throw APIError.conflict
        case 403: throw APIError.forbidden
        case 429: throw APIError.rateLimited
        default: throw APIError.server
        }
    }
    private func clearSession() {
        session = nil; expiry = .distantPast; onSessionChange?(nil)
    }
    private func discardIssuedCookie(_ cookie: String) async {
        if let r = try? request("auth/logout",method:"POST",cookie:cookie) { _ = try? await send(r) }
        clearSession(); try? secrets.clear()
    }
    private func accept(_ data: Data, _ response: HTTPURLResponse) async throws -> SessionPayload {
        guard let header = response.value(forHTTPHeaderField:"Set-Cookie"),
              let cookie = HTTPCookie.cookies(withResponseHeaderFields:["Set-Cookie":header], for:baseURL).first(where:{ $0.name == "tavixo_refresh" && $0.isSecure && $0.path == "/api/auth" && $0.domain.trimmingCharacters(in:CharacterSet(charactersIn:".")) == baseURL.host }),
              cookie.value.range(of:"^[A-Za-z0-9_-]{1,256}$",options:.regularExpression) != nil else {
            clearSession(); try secrets.clear(); throw APIError.invalidResponse
        }
        let result: SessionPayload
        do {
            result = try JSONDecoder().decode(SessionPayload.self, from:data)
            guard !result.accessToken.isEmpty, result.expiresIn > 0 else { throw APIError.invalidResponse }
        } catch {
            await discardIssuedCookie(cookie.value); throw APIError.invalidResponse
        }
        do { try secrets.write(cookie.value) } catch {
            // Do not keep an unusable rotated credential or an authenticated UI.
            await discardIssuedCookie(cookie.value); throw APIError.storage
        }
        session = result; expiry = Date().addingTimeInterval(TimeInterval(result.expiresIn)); onSessionChange?(result)
        return result
    }
    func login(restaurant: String, email: String, password: String) async throws -> SessionPayload {
        let body = try JSONSerialization.data(withJSONObject:["restaurantSlug":restaurant.trimmingCharacters(in:.whitespacesAndNewlines), "email":email.trimmingCharacters(in:.whitespacesAndNewlines), "password":password])
        let (data, response) = try await send(request("auth/login", method:"POST", body:body))
        try check(response, login:true)
        return try await accept(data,response)
    }
    func renew() async throws -> SessionPayload {
        if let refreshTask { return try await refreshTask.value }
        let task = Task { @MainActor in
            guard let cookie = try secrets.read() else { throw APIError.unauthorized }
            let (data,response) = try await send(request("auth/refresh", method:"POST", cookie:cookie))
            if response.statusCode == 401 {
                clearSession(); try secrets.clear(); throw APIError.unauthorized
            }
            try check(response)
            return try await accept(data,response)
        }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }
    func get<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        if session == nil || expiry.timeIntervalSinceNow < 45 { _ = try await renew() }
        guard let firstToken = session?.accessToken else { throw APIError.unauthorized }
        var (data, response) = try await send(request(path,token:firstToken))
        if response.statusCode == 401 {
            if session?.accessToken == firstToken { _ = try await renew() }
            guard let token = session?.accessToken else { throw APIError.unauthorized }
            (data,response) = try await send(request(path,token:token))
        }
        if response.statusCode == 401 { clearSession(); try secrets.clear() }
        try check(response)
        do { return try JSONDecoder().decode(T.self,from:data) } catch { throw APIError.invalidResponse }
    }
    // A mutation is sent once. Explicit retries keep the original persisted UUID/body.
    func post<Body: Encodable, Result: Decodable>(_ path: String, body: Body, context: String, as type: Result.Type) async throws -> Result {
        if session == nil || expiry.timeIntervalSinceNow < 45 { _ = try await renew() }
        guard session?.context == context, let token = session?.accessToken else { throw APIError.contextChanged }
        let encoded = try JSONEncoder().encode(body)
        let (data, response) = try await send(request(path, method:"POST", body:encoded, token:token))
        if response.statusCode == 401 { clearSession(); try secrets.clear() }
        try check(response)
        guard session?.context == context else { throw APIError.contextChanged }
        do { return try JSONDecoder().decode(Result.self, from:data) } catch { throw APIError.invalidResponse }
    }
    func logout() async throws {
        // Wait for rotation so logout revokes the current cookie, not an old one.
        if let refreshTask { _ = try? await refreshTask.value }
        if let cookie = try secrets.read() {
            let (_,response) = try await send(request("auth/logout",method:"POST",cookie:cookie)); try check(response)
        }
        clearSession(); try secrets.clear()
    }
    func forgetLocalSession() throws { try secrets.clear(); clearSession() }
}
