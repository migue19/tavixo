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
    @Published private(set) var sendingOrder = false
    @Published private var unresolvedOrder: PendingOrder?
    @Published private(set) var pendingStorageReady = false
    private let pendingSecrets: SecretStore
    private let api: APIClient
    private var generation = 0
    private var restored = false

    init(api: APIClient = APIClient(), pendingSecrets: SecretStore = KeychainStore(service:"mx.com.nut.tavixo.pending-order")) {
        self.api = api; self.pendingSecrets = pendingSecrets
        api.onSessionChange = { [weak self] value in
            guard let self else { return }
            if self.session?.context != value?.context { self.clearWorkspace() }
            self.session = value; self.screen = value == nil ? .login : .workspace
            if value != nil { self.restorePendingOrder() }
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
        guard !authBusy, !sendingOrder else { return }; authBusy = true; error = nil
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
            if let pending = pendingOrder, branches.contains(where: { $0.id == pending.branchID }) { selectedBranchID = pending.branchID }
            else if !branches.contains(where: { $0.id == selectedBranchID }) { selectedBranchID = branches.first?.id ?? "" }
        } catch { if ticket == generation { self.error = error.localizedDescription } }
    }
    func selectBranch(_ id: String) {
        guard !sendingOrder, pendingOrder == nil, branches.contains(where: { $0.id == id }), id != selectedBranchID else { return }
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
        if !pendingStorageReady { restorePendingOrder() }
        if branches.isEmpty { await loadBranches() }
        await loadBranch()
    }
    var pendingOrder: PendingOrder? {
        guard !isDemo, let session, let pending = unresolvedOrder, pending.belongs(to:session) else { return nil }
        return pending
    }
    var canTakeOrders: Bool { session?.user.role != nil && session?.user.role != .kitchen }
    var canStartOrder: Bool { canTakeOrders && !sendingOrder && (isDemo || (pendingStorageReady && unresolvedOrder == nil)) }
    var hasForeignPendingOrder: Bool { !isDemo && unresolvedOrder != nil && pendingOrder == nil }
    private func restorePendingOrder() {
        do {
            if let raw = try pendingSecrets.read() {
                unresolvedOrder = try JSONDecoder().decode(PendingOrder.self, from:Data(raw.utf8))
            } else { unresolvedOrder = nil }
            pendingStorageReady = true
        } catch { pendingStorageReady = false; self.error = "No se pudo recuperar el envío pendiente del llavero. No envíes otro pedido hasta recuperar el acceso." }
    }
    func loadMenu(branchID: String, context: String) async throws -> ([MenuCategory], [MenuProduct]) {
        guard session?.context == context, selectedBranchID == branchID, canTakeOrders else { throw APIError.contextChanged }
        #if DEBUG
        if isDemo { return (DemoData.categories, DemoData.products) }
        #endif
        guard UUID(uuidString:branchID) != nil else { throw APIError.invalidInput }
        let prefix = "restaurant/branches/\(branchID)/"
        let categories = try await api.get(prefix + "categories",as:[MenuCategory].self)
        let products = try await api.get(prefix + "products",as:[MenuProduct].self)
        guard session?.context == context, selectedBranchID == branchID else { throw APIError.contextChanged }
        return (categories, availableProducts(products,categories:categories))
    }
    func sendOrder(target: OrderTarget, items: [OrderLineInput], notes: String, branchID: String, context: String) async throws -> RestaurantOrder {
        guard !sendingOrder, let current = session, current.context == context, selectedBranchID == branchID, canTakeOrders else { throw APIError.contextChanged }
        guard validOrderLines(items,notes:notes) else { throw APIError.invalidInput }
        #if DEBUG
        if isDemo { return try sendDemoOrder(target:target,items:items,notes:notes) }
        #endif
        guard pendingStorageReady, !hasForeignPendingOrder, UUID(uuidString:branchID) != nil,
              UUID(uuidString:target.tableID) != nil,
              target.orderID == nil || UUID(uuidString:target.orderID!) != nil else { throw APIError.storage }
        let wasRetry = pendingOrder != nil
        let pending: PendingOrder
        if let saved = pendingOrder {
            guard saved.branchID == branchID, saved.target.id == target.id else { throw APIError.conflict }
            pending = saved // Never rebuild an uncertain request from edited UI or newer totals.
        } else {
            let body = OrderWriteBody(requestId:UUID().uuidString.lowercased(),tableId:target.orderID == nil ? target.tableID : nil,
                                      expectedTotalCents:target.expectedTotalCents,notes:notes,items:items)
            pending = PendingOrder(restaurantID:current.restaurant.id,userID:current.user.id,branchID:branchID,
                                   tableID:target.tableID,tableName:target.tableName,orderID:target.orderID,body:body)
            let raw = try JSONEncoder().encode(pending)
            try pendingSecrets.write(String(decoding:raw,as:UTF8.self)) // Persist before any write leaves the device.
            unresolvedOrder = pending
        }
        sendingOrder = true
        defer { sendingOrder = false }
        do {
            let result = try await api.post(pending.path,body:pending.body,context:context,as:RestaurantOrder.self)
            // If deletion fails, keep the UUID and replay safely on the next explicit retry.
            try pendingSecrets.clear(); unresolvedOrder = nil
            if session?.context == context, selectedBranchID == branchID {
                orders.removeAll { $0.id == result.id }; orders.insert(result,at:0); lastUpdated = Date()
            }
            return result
        } catch {
            // These statuses definitively reject this operation; network/5xx/decode/auth stay pending.
            if !wasRetry, let apiError = error as? APIError {
                switch apiError {
                case .invalidInput, .conflict, .forbidden:
                    try pendingSecrets.clear(); unresolvedOrder = nil
                default: break
                }
            }
            throw error
        }
    }
    #if DEBUG
    private func sendDemoOrder(target: OrderTarget, items: [OrderLineInput], notes: String) throws -> RestaurantOrder {
        let lines = try items.map { line -> OrderItem in
            guard let product = DemoData.products.first(where: { $0.id == line.productId }) else { throw APIError.invalidInput }
            return OrderItem(id:UUID().uuidString,name:product.name,quantity:line.quantity,cancelledQuantity:0,unitPriceCents:product.priceCents,notes:line.notes)
        }
        let previous = target.orderID.flatMap { id in orders.first { $0.id == id } }
        guard target.orderID == nil || previous?.isOpen == true else { throw APIError.conflict }
        guard previous != nil || !openOrders.contains(where: { $0.tableId == target.tableID }) else { throw APIError.conflict }
        let result = RestaurantOrder(id:previous?.id ?? UUID().uuidString,number:previous?.number ?? ((orders.map(\.number).max() ?? 0)+1),
                                     tableId:target.tableID,tableName:target.tableName,status:"SENT",
                                     totalCents:(previous?.totalCents ?? 0) + lines.reduce(0){$0 + $1.quantity * $1.unitPriceCents},
                                     notes:previous?.notes ?? notes,createdByName:"Equipo de ejemplo",createdAt:ISO8601DateFormatter().string(from:Date()),items:(previous?.items ?? []) + lines)
        orders.removeAll { $0.id == result.id }; orders.insert(result,at:0); lastUpdated = Date(); return result
    }
    #endif
    #if DEBUG
    func startDemo() {
        guard !authBusy else { return }
        clearWorkspace(); isDemo = true; session = DemoData.session; branches = DemoData.branches
        selectedBranchID = DemoData.branchID; tables = DemoData.tables; orders = DemoData.orders
        lastUpdated = Date(); screen = .workspace
    }
    #endif
}
