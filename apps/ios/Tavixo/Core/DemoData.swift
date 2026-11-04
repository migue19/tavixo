#if DEBUG
import Foundation

enum DemoData {
    static let branchID = "00000000-0000-4000-8000-000000000002"
    static let session = SessionPayload(accessToken:"local-demo-not-a-token",expiresIn:900,
        user:StaffUser(id:"demo",name:"Equipo Tavixo",email:"demo@example.test",role:.owner,branchId:nil),
        restaurant:Restaurant(id:"demo",name:"Restaurante de ejemplo",slug:"demo",branding:nil))
    static let categories = [MenuCategory(id:"demo-category",name:"Menú de ejemplo",active:true)]
    static let products = [MenuProduct(id:"00000000-0000-4000-8000-000000000010",categoryId:"demo-category",name:"Plato de la casa",description:"Receta de ejemplo",priceCents:12000,active:true,available:true), MenuProduct(id:"00000000-0000-4000-8000-000000000011",categoryId:"demo-category",name:"Agua fresca",description:"Vaso de ejemplo",priceCents:2000,active:true,available:true)]
    static let branches = [Branch(id:branchID,name:"Sucursal de ejemplo",address:"",active:true)]
    static let tables = [DiningTable(id:"table-1",name:"Mesa 1",capacity:4,active:true),DiningTable(id:"table-2",name:"Mesa 2",capacity:6,active:true),DiningTable(id:"table-3",name:"Mesa 3",capacity:4,active:true)]
    static let orders = [RestaurantOrder(id:"order-1",number:12,tableId:"table-1",tableName:"Mesa 1",status:"PREPARING",totalCents:28000,notes:"Sin cebolla en un plato",createdByName:"Equipo de ejemplo",createdAt:"2026-11-02T15:00:00.000Z",items:[OrderItem(id:"line-1",name:"Plato de la casa",quantity:2,cancelledQuantity:0,unitPriceCents:12000,notes:""),OrderItem(id:"line-2",name:"Agua fresca",quantity:2,cancelledQuantity:0,unitPriceCents:2000,notes:"")]),RestaurantOrder(id:"order-2",number:13,tableId:"table-2",tableName:"Mesa 2",status:"READY",totalCents:14500,notes:"",createdByName:"Equipo de ejemplo",createdAt:"2026-11-02T15:10:00.000Z",items:[OrderItem(id:"line-3",name:"Menú del día",quantity:1,cancelledQuantity:0,unitPriceCents:14500,notes:"")])]
}
#endif
