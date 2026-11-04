import Foundation

enum StaffRole: String, Codable, Sendable {
    case owner = "OWNER", manager = "MANAGER", cashier = "CASHIER", waiter = "WAITER", kitchen = "KITCHEN"
    var administrative: Bool { self == .owner || self == .manager }
    var label: String { switch self { case .owner: "Propietario"; case .manager: "Gerente"; case .cashier: "Caja"; case .waiter: "Mesero"; case .kitchen: "Cocina" } }
}
struct RestaurantBrand: Codable, Sendable {
    let primary: String
    let accent: String
    let surface: String
    let logo: String?
}
struct Restaurant: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let slug: String
    let branding: RestaurantBrand?
}
struct StaffUser: Codable, Sendable {
    let id: String
    let name: String
    let email: String
    let role: StaffRole
    let branchId: String?
}
struct SessionPayload: Codable, Sendable {
    let accessToken: String
    let expiresIn: Int
    let user: StaffUser
    let restaurant: Restaurant
    var context: String { "\(restaurant.id)|\(user.id)|\(user.role.rawValue)|\(user.branchId ?? "")" }
}
struct Branch: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let address: String?
    let active: Bool
}
struct DiningTable: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let capacity: Int
    let active: Bool
}
struct OrderItem: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let quantity: Int
    let cancelledQuantity: Int
    let unitPriceCents: Int
    let notes: String?
    var remaining: Int { max(0, quantity - cancelledQuantity) }
}
struct RestaurantOrder: Codable, Identifiable, Sendable {
    let id: String
    let number: Int
    let tableId: String?
    let tableName: String
    let status: String
    let totalCents: Int
    let notes: String?
    let createdByName: String
    let createdAt: String
    let items: [OrderItem]
    var rounds: [OrderRound]? = nil
    var isOpen: Bool { status != "CLOSED" && status != "CANCELLED" }
    var statusLabel: String {
        ["SENT":"Enviada", "PREPARING":"En preparación", "READY":"Lista", "DELIVERED":"Entregada", "CLOSED":"Cerrada", "CANCELLED":"Cancelada"][status] ?? "Estado por revisar"
    }
}
func money(_ cents: Int) -> String {
    (Decimal(cents) / 100).formatted(.currency(code: "MXN").locale(Locale(identifier: "es_MX")))
}
func permittedBranches(_ branches: [Branch], user: StaffUser) -> [Branch] {
    branches.filter { $0.active && (user.role.administrative || $0.id == user.branchId) }
}

struct MenuCategory: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let active: Bool
}
struct MenuProduct: Codable, Identifiable, Sendable {
    let id: String
    let categoryId: String
    let name: String
    let description: String
    let priceCents: Int
    let active: Bool
    let available: Bool
}
struct OrderLineInput: Codable, Equatable, Sendable {
    let productId: String
    var quantity: Int
    var notes: String
}
struct OrderWriteBody: Codable, Equatable, Sendable {
    let requestId: String
    let tableId: String?
    let expectedTotalCents: Int?
    let notes: String
    let items: [OrderLineInput]
}
struct OrderTarget: Identifiable, Sendable {
    let tableID: String
    let tableName: String
    let orderID: String?
    let expectedTotalCents: Int?
    var id: String { orderID ?? tableID }
}
struct PendingOrder: Codable, Sendable {
    let restaurantID: String
    let userID: String
    let branchID: String
    let tableID: String
    let tableName: String
    let orderID: String?
    let body: OrderWriteBody
    var target: OrderTarget { OrderTarget(tableID:tableID, tableName:tableName, orderID:orderID, expectedTotalCents:body.expectedTotalCents) }
    func belongs(to session: SessionPayload) -> Bool {
        restaurantID == session.restaurant.id && userID == session.user.id
    }
    var path: String {
        "restaurant/branches/\(branchID)/orders" + (orderID.map { "/\($0)/rounds" } ?? "")
    }
}
func availableProducts(_ products: [MenuProduct], categories: [MenuCategory]) -> [MenuProduct] {
    let active = Set(categories.filter(\.active).map(\.id))
    return products.filter { $0.active && $0.available && active.contains($0.categoryId) }
}
func validOrderLines(_ items: [OrderLineInput], notes: String) -> Bool {
    !items.isEmpty && items.count <= 100 && Set(items.map(\.productId)).count == items.count && notes.utf16.count <= 500 &&
    items.allSatisfy { UUID(uuidString:$0.productId) != nil && (1...100).contains($0.quantity) && $0.notes.utf16.count <= 300 }
}

struct OrderPresentation: Identifiable {
    let target: OrderTarget
    let branchID: String
    let context: String
    var id: String { target.id }
}

struct OrderRound: Codable, Identifiable, Sendable {
    let id: String
    let number: Int
    let notes: String
    let status: String
}
