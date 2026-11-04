import SwiftUI

struct WorkspaceView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var composer: OrderPresentation?
    let session: SessionPayload
    private var tint: Color { Color(brandHex:session.restaurant.branding?.primary ?? "A3432F",fallback:BrandTheme.primary) }
    var body: some View {
        VStack(spacing:0) {
            if store.isDemo { Label("DEMO LOCAL · datos ficticios",systemImage:"testtube.2").font(.caption.bold()).frame(maxWidth:.infinity).padding(10).background(BrandTheme.maize).foregroundStyle(BrandTheme.ink) }
            if let error = store.error {
                VStack(alignment:.leading,spacing:8) {
                    Label(error,systemImage:"exclamationmark.triangle").font(.callout)
                    Button("Reintentar") { Task { await store.refresh() } }
                }.padding().frame(maxWidth:.infinity,alignment:.leading).background(Color.orange.opacity(0.15))
            }
            if let pending = store.pendingOrder {
                VStack(alignment:.leading,spacing:8) {
                    Label("Tienes un envío pendiente de confirmar",systemImage:"clock.arrow.circlepath").font(.headline)
                    Text("Recupera el mismo envío antes de tomar otro pedido.").font(.caption)
                    if !store.canTakeOrders || !store.branches.contains(where: { $0.id == pending.branchID }) {
                        Text("Tu acceso actual no permite resolver este envío. Pide al responsable revisar tus permisos sin crear un pedido de reemplazo.").font(.caption)
                    }
                    Button("Recuperar envío pendiente") { composer = OrderPresentation(target:pending.target,branchID:store.selectedBranchID,context:session.context) }.disabled(!store.canTakeOrders || store.selectedBranchID != pending.branchID)
                }.padding().frame(maxWidth:.infinity,alignment:.leading).background(BrandTheme.maize.opacity(0.3))
            } else if store.hasForeignPendingOrder {
                Text("Hay un envío pendiente de otra cuenta. Inicia sesión con esa cuenta para resolverlo antes de tomar pedidos nuevos en este dispositivo.").font(.callout).padding()
            }
            if !store.isDemo && !store.pendingStorageReady {
                VStack(alignment:.leading,spacing:8) {
                    Text("El llavero de envíos no está disponible. Los pedidos nuevos están bloqueados hasta recuperarlo.").font(.callout)
                    Button("Volver a comprobar") { Task { await store.refresh() } }
                }.padding()
            }
            TabView {
                NavigationStack { overview.navigationTitle("Mi restaurante").navigationBarTitleDisplayMode(.inline) }.tabItem { Label("Inicio",systemImage:"square.grid.2x2") }
                NavigationStack { tables.navigationTitle("Mesas") }.tabItem { Label("Mesas",systemImage:"table.furniture") }
                NavigationStack { orders.navigationTitle("Comandas") }.tabItem { Label("Comandas",systemImage:"list.bullet.rectangle") }
                NavigationStack { account.navigationTitle("Mi cuenta") }.tabItem { Label("Cuenta",systemImage:"person.crop.circle") }
            }
        }.sheet(item:$composer) { presentation in
            OrderComposerView(target:presentation.target,branchID:presentation.branchID,context:presentation.context).environmentObject(store)
        }.tint(tint).task(id:session.context) { await store.loadBranches() }.task(id:store.selectedBranchID) { await store.loadBranch() }
    }
    private var branchPicker: some View {
        VStack(alignment:.leading,spacing:8) {
            if !store.branches.isEmpty {
                Picker("Sucursal",selection:Binding(get:{store.selectedBranchID},set:{store.selectBranch($0)})) {
                    ForEach(store.branches) { branch in Text(branch.name).tag(branch.id) }
                }.pickerStyle(.menu).disabled(store.sendingOrder || store.pendingOrder != nil).accessibilityIdentifier("branch-picker")
            } else if !store.loading { Text("No tienes una sucursal activa disponible.").foregroundStyle(.secondary) }
            if let updated = store.lastUpdated { Text("Actualizado \(updated.formatted(date:.omitted,time:.shortened)) · desliza para actualizar").font(.caption).foregroundStyle(.secondary) }
        }
    }
    private var overview: some View {
        ScrollView {
            VStack(alignment:.leading,spacing:24) {
                HStack(spacing:14) {
                    RestaurantAvatar(restaurant:session.restaurant)
                    VStack(alignment:.leading,spacing:5) {
                        Text(session.restaurant.name).font(BrandTheme.font(24,style:.title2,weight:.bold))
                        Text("\(session.user.name) · \(session.user.role.label)").font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                branchPicker
                if store.loading { ProgressView("Actualizando operación…").frame(maxWidth:.infinity).padding() }
                else if store.lastUpdated != nil {
                    LazyVGrid(columns:Array(repeating:GridItem(.flexible(),alignment:.leading),count:typeSize >= .xxxLarge ? 1 : 3),spacing:12) { metrics }
                    if session.user.role != .kitchen {
                        VStack(alignment:.leading,spacing:10) {
                            Text("Total en cuentas abiertas").font(.subheadline)
                            Text(money(store.openOrders.reduce(0){$0 + $1.totalCents})).font(BrandTheme.font(32,style:.largeTitle,weight:.bold)).contentTransition(.numericText())
                            Text("Importes de las cuentas actuales; no es un reporte de ventas cobradas.").font(.caption).foregroundStyle(.secondary)
                        }.padding(22).frame(maxWidth:.infinity,alignment:.leading).background(.white,in:RoundedRectangle(cornerRadius:20))
                    }
                    Text("Comandas abiertas").font(BrandTheme.font(22,style:.title3,weight:.bold))
                    if store.openOrders.isEmpty { ContentUnavailableView("Todo al día",systemImage:"checkmark.circle",description:Text("No hay comandas abiertas en esta sucursal.")) }
                    else { ForEach(store.openOrders.prefix(5)) { order in NavigationLink { OrderDetailView(order:order,showMoney:session.user.role != .kitchen) } label: { OrderRow(order:order,showMoney:session.user.role != .kitchen) }.buttonStyle(.plain) } }
                }
            }.padding(24).frame(maxWidth:800).frame(maxWidth:.infinity)
        }.background(BrandTheme.cream).refreshable { await store.refresh() }.privacySensitive()
    }
    @ViewBuilder private var metrics: some View {
        metric("Abiertas",value:store.openOrders.count,icon:"list.bullet.rectangle")
        metric("Mesas ocupadas",value:store.tables.filter { $0.active && store.occupied($0) }.count,icon:"person.2")
        metric("Mesas libres",value:store.tables.filter { $0.active && !store.occupied($0) }.count,icon:"table.furniture")
    }
    private func metric(_ title: String,value: Int,icon: String) -> some View {
        VStack(alignment:.leading,spacing:10) { Image(systemName:icon).foregroundStyle(tint); Text(value.formatted()).font(.title.bold()); Text(title).font(.caption).foregroundStyle(.secondary) }.padding(14).frame(maxWidth:.infinity,minHeight:125,alignment:.topLeading).background(.white,in:RoundedRectangle(cornerRadius:16))
    }
    private var tables: some View {
        List {
            Section { branchPicker }
            if store.loading { ProgressView("Cargando mesas…") }
            else if store.lastUpdated != nil && store.tables.isEmpty { ContentUnavailableView("Sin mesas",systemImage:"table.furniture",description:Text("No hay mesas registradas en esta sucursal.")) }
            ForEach(store.tables) { table in
                VStack(alignment:.leading,spacing:8) {
                    HStack { Text(table.name).font(.headline); Spacer(); Label(!table.active ? "Inactiva" : store.occupied(table) ? "Ocupada" : "Libre",systemImage:!table.active ? "minus.circle" : store.occupied(table) ? "person.2.fill" : "checkmark.circle").font(.caption) }
                    Text("\(table.capacity) lugares").font(.subheadline).foregroundStyle(.secondary)
                    if table.active && !store.occupied(table) && store.canTakeOrders {
                        Button("Tomar pedido") { composer = OrderPresentation(target:OrderTarget(tableID:table.id,tableName:table.name,orderID:nil,expectedTotalCents:nil),branchID:store.selectedBranchID,context:session.context) }
                            .disabled(!store.canStartOrder || store.loading).accessibilityIdentifier("new-order-\(table.id)")
                    }
                    ForEach(store.openOrders.filter { $0.tableId == table.id }) { order in
                        NavigationLink { OrderDetailView(order:order,showMoney:session.user.role != .kitchen) } label: { Text("Ver comanda #\(order.number)") }
                    }
                }.padding(.vertical,8)
            }
        }.refreshable { await store.refresh() }.privacySensitive()
    }
    private var orders: some View {
        List {
            Section { branchPicker }
            if store.loading { ProgressView("Cargando comandas…") }
            else if store.lastUpdated != nil && store.orders.isEmpty { ContentUnavailableView("Sin comandas",systemImage:"tray",description:Text("No hay cuentas para mostrar en esta sucursal.")) }
            Section("Abiertas") {
                ForEach(store.openOrders) { order in NavigationLink { OrderDetailView(order:order,showMoney:session.user.role != .kitchen) } label: { OrderRow(order:order,showMoney:session.user.role != .kitchen) } }
            }
            if session.user.role != .kitchen {
                Section("Cerradas y canceladas recientes · hasta 50") {
                    ForEach(store.orders.filter { !$0.isOpen }) { order in NavigationLink { OrderDetailView(order:order,showMoney:true) } label: { OrderRow(order:order,showMoney:true) } }
                }
            }
        }.refreshable { await store.refresh() }.privacySensitive()
    }
    private var account: some View {
        List {
            Section("Tu acceso") { LabeledContent("Nombre",value:session.user.name); LabeledContent("Correo",value:session.user.email); LabeledContent("Rol",value:session.user.role.label); LabeledContent("Restaurante",value:session.restaurant.name) }
            Section("App nativa") {
                Text("Consulta, toma de pedidos y nuevas rondas con actualización manual. Requiere conexión para enviar y confirmar pedidos.")
                Text("Cocina interactiva y cobros siguen disponibles en la web; se incorporarán por etapas en la app nativa.")
                Link("Abrir Tavixo web",destination:APIClient.productionURL)
            }
            Section { Button(store.authBusy ? "Cerrando sesión…" : "Cerrar sesión",role:.destructive) { Task { await store.logout() } }.disabled(store.authBusy || store.sendingOrder).accessibilityIdentifier("logout-button") }
        }.privacySensitive()
    }
}
struct OrderRow: View {
    let order: RestaurantOrder
    let showMoney: Bool
    var body: some View {
        VStack(alignment:.leading,spacing:10) {
            HStack { Text("#\(order.number) · \(order.tableName)").font(.headline); Spacer(); if showMoney { Text(money(order.totalCents)).fontWeight(.semibold) } }
            StatusPill(order:order)
        }.padding(.vertical,8).frame(maxWidth:.infinity,alignment:.leading)
    }
}
struct OrderDetailView: View {
    @EnvironmentObject private var store: AppStore
    @State private var composer: OrderPresentation?
    let order: RestaurantOrder
    private var current: RestaurantOrder { store.orders.first { $0.id == order.id } ?? order }
    let showMoney: Bool
    var body: some View {
        List {
            Section { Text(current.tableName).font(.title2.bold()); StatusPill(order:current); Text("Registró: \(current.createdByName)").font(.subheadline) }
            if current.isOpen && store.orders.contains(where: { $0.id == order.id }) && store.canTakeOrders, let tableID = current.tableId {
                Section {
                    Button("Agregar otra ronda") { composer = OrderPresentation(target:OrderTarget(tableID:tableID,tableName:current.tableName,orderID:current.id,expectedTotalCents:current.totalCents),branchID:store.selectedBranchID,context:store.session?.context ?? "") }
                        .disabled(!store.canStartOrder || store.loading).accessibilityIdentifier("add-round")
                }
            }
            Section("Productos vigentes") {
                ForEach(current.items.filter { $0.remaining > 0 }) { item in
                    VStack(alignment:.leading,spacing:8) {
                        HStack(alignment:.top) { Text("\(item.remaining) × \(item.name)"); Spacer(); if showMoney { Text(money(item.remaining * item.unitPriceCents)).monospacedDigit() } }
                        if let notes = item.notes, !notes.isEmpty { Text(notes).font(.callout).foregroundStyle(.secondary) }
                        if item.cancelledQuantity > 0 { Text("\(item.cancelledQuantity) cancelados").font(.caption).foregroundStyle(.secondary) }
                    }.padding(.vertical,4)
                }
            }
            if let notes = current.notes, !notes.isEmpty { Section("Notas de la cuenta") { Text(notes) } }
            if let rounds = current.rounds, !rounds.isEmpty {
                Section("Rondas enviadas") {
                    ForEach(rounds) { round in
                        VStack(alignment:.leading,spacing:6) {
                            Text("Ronda \(round.number)").font(.headline)
                            Text(["SENT":"Enviada", "PREPARING":"En preparación", "READY":"Lista", "DELIVERED":"Entregada", "CANCELLED":"Cancelada"][round.status] ?? "Estado por revisar").font(.caption).foregroundStyle(.secondary)
                            if !round.notes.isEmpty { Text(round.notes).font(.callout) }
                        }
                    }
                }
            }
            if showMoney { Section { LabeledContent("Total de la cuenta",value:money(current.totalCents)).font(.headline) } }
            Section { Text("Actualiza para consultar los cambios de otros dispositivos. El ticket operativo no es CFDI.").font(.caption).foregroundStyle(.secondary) }
        }.navigationTitle("Comanda #\(current.number)").refreshable { await store.refresh() }
            .sheet(item:$composer) { presentation in OrderComposerView(target:presentation.target,branchID:presentation.branchID,context:presentation.context).environmentObject(store) }
            .privacySensitive()
    }
}
