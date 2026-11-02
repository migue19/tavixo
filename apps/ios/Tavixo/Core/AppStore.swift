import Foundation
import Combine

@MainActor final class AppStore: ObservableObject {
    enum Screen { case startup, login, recovery, workspace }
    @Published private(set) var screen: Screen = .startup
    @Published private(set) var session: SessionPayload?
    @Published private(set) var branches: [Branch] = []
    @Published private(set) var selectedBranchID = ""
    @Published private(set) var tables: [DiningTable] = []
    @Published private(set) var orders: [RestaurantOrder] = []
    @Published private(set) var loading = false
    @Published private(set) var authBusy = false
    @Published var error: String?
    @Published private(set) var lastUpdated: Date?
    @Published private(set) var isDemo = false
    private let api: APIClient
    private var generation = 0
    private var restored = false

    init(api: APIClient = APIClient()) {
        self.api = api
        api.onSessionChange = { [weak self] value in
            guard let self else { return }
            if self.session?.context != value?.context { self.clearWorkspace() }
            self.session = value; self.screen = value == nil ? .login : .workspace
        }
    }
    var openOrders: [RestaurantOrder] { orders.filter(\.isOpen) }
    var selectedBranch: Branch? { branches.first { $0.id == selectedBranchID } }
    func occupied(_ table: DiningTable) -> Bool { openOrders.contains { $0.tableId == table.id } }
    private func clearWorkspace() {
        generation += 1; branches = []; selectedBranchID = ""; tables = []; orders = []; lastUpdated = nil; error = nil; loading = false
    }
    func restore() async {
        guard !restored else { return }; restored = true
        await retryRestore()
    }
    func retryRestore() async {
        screen = .startup; error = nil
        do {
            guard try api.hasSavedSession() else { screen = .login; return }
            _ = try await api.renew()
        } catch APIError.unauthorized { screen = .login; self.error = APIError.unauthorized.localizedDescription }
        catch { screen = .recovery; self.error = error.localizedDescription }
    }
    func login(restaurant: String, email: String, password: String) async {
        guard !authBusy else { return }; authBusy = true; error = nil
        defer { authBusy = false }
        do { _ = try await api.login(restaurant:restaurant,email:email,password:password) }
        catch { self.error = error.localizedDescription }
    }
    func logout() async {
        guard !authBusy else { return }; authBusy = true; error = nil
        defer { authBusy = false }
        if isDemo { isDemo = false; session = nil; clearWorkspace(); screen = .login; return }
        do { try await api.logout() } catch { self.error = "No se pudo cerrar la sesión. \(error.localizedDescription)" }
    }
    func forgetLocalSession() {
        do { try api.forgetLocalSession(); session = nil; clearWorkspace(); screen = .login }
        catch { self.error = error.localizedDescription }
    }
    func loadBranches() async {
        guard let current = session else { return }
        if isDemo { return }
        generation += 1; let ticket = generation
        loading = true; error = nil; tables = []; orders = []; lastUpdated = nil
        defer { if generation == ticket { loading = false } }
        do {
            let result = try await api.get("restaurant/branches", as:[Branch].self)
            guard ticket == generation, session?.context == current.context else { return }
            branches = permittedBranches(result,user:current.user)
            if !branches.contains(where: { $0.id == selectedBranchID }) { selectedBranchID = branches.first?.id ?? "" }
        } catch { if ticket == generation { self.error = error.localizedDescription } }
    }
    func selectBranch(_ id: String) {
        guard branches.contains(where: { $0.id == id }), id != selectedBranchID else { return }
        generation += 1; tables = []; orders = []; lastUpdated = nil; error = nil
        selectedBranchID = id
    }
    func loadBranch() async {
        guard let current = session, let branch = selectedBranch, UUID(uuidString:branch.id) != nil else { return }
        if isDemo { return }
        generation += 1; let ticket = generation
        loading = true; error = nil; orders = []; tables = []; lastUpdated = nil
        defer { if generation == ticket { loading = false } }
        do {
            let prefix = "restaurant/branches/\(branch.id)/"
            let newTables = try await api.get(prefix + "tables",as:[DiningTable].self)
            let newOrders = try await api.get(prefix + "orders",as:[RestaurantOrder].self)
            guard ticket == generation, selectedBranchID == branch.id, session?.context == current.context else { return }
            tables = newTables; orders = newOrders; lastUpdated = Date()
        } catch { if ticket == generation { self.error = error.localizedDescription } }
    }
    func refresh() async {
        if isDemo { return }
        if branches.isEmpty { await loadBranches() }
        await loadBranch()
    }
    #if DEBUG
    func startDemo() {
        guard !authBusy else { return }
        clearWorkspace(); isDemo = true; session = DemoData.session; branches = DemoData.branches
        selectedBranchID = DemoData.branchID; tables = DemoData.tables; orders = DemoData.orders
        lastUpdated = Date(); screen = .workspace
    }
    #endif
}
