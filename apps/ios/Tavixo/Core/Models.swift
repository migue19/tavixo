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
