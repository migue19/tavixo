import SwiftUI

struct OrderComposerView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let target: OrderTarget
    let branchID: String
    let context: String
    @State private var categories: [MenuCategory] = []
    @State private var products: [MenuProduct] = []
    @State private var lines: [OrderLineInput] = []
    @State private var notes = ""
    @State private var search = ""
    @State private var categoryID = ""
    @State private var loading = true
    @State private var message: String?
    @State private var confirming = false
    @State private var discard = false
    @State private var completed: RestaurantOrder?
    @State private var requiresReview = false
    @State private var reviewing = false
    private var pending: PendingOrder? { store.pendingOrder }
    private var frozen: Bool { pending != nil || store.sendingOrder || completed != nil }
    private var currentLines: [OrderLineInput] { pending?.body.items ?? lines }
    private var estimate: Int { currentLines.reduce(0) { total,line in total + line.quantity * (products.first { $0.id == line.productId }?.priceCents ?? 0) } }
    private var contextValid: Bool { store.session?.context == context && store.selectedBranchID == branchID && store.canTakeOrders }
    private var visibleProducts: [MenuProduct] {
        products.filter { (categoryID.isEmpty || $0.categoryId == categoryID) && (search.isEmpty || $0.name.localizedStandardContains(search) || $0.description.localizedStandardContains(search)) }
    }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(target.tableName).font(.title2.bold())
                    Text(target.orderID == nil ? "Nueva cuenta" : "Nueva ronda para la cuenta abierta").foregroundStyle(.secondary)
                    if store.isDemo { Text("Prueba ficticia: no se enviará al restaurante.").font(.caption) }
                }
                if let completed {
                    Section {
                        Label("Comanda #\(completed.number) confirmada",systemImage:"checkmark.circle.fill").foregroundStyle(.green)
                        LabeledContent("Total vigente de la cuenta",value:money(completed.totalCents))
                        Button("Listo") { dismiss() }.accessibilityIdentifier("order-done")
                    }
                } else {
                    if let message { Section { Label(message,systemImage:"exclamationmark.triangle").foregroundStyle(.primary) } }
                    if pending != nil {
                        Section("Envío pendiente de confirmar") {
                            Text("El resultado del envío aún no está confirmado en este dispositivo. Reintenta este mismo envío; no abras otra cuenta. El pedido queda protegido en el llavero aunque cierres la app.")
                            Text("Los productos, notas y referencia de envío permanecen sin cambios.").font(.caption)
                        }
                    }
                    if loading { Section { ProgressView("Cargando menú…") } }
                    if !frozen && !reviewing {
                        Section("Menú disponible") {
                            TextField("Buscar producto",text:$search).accessibilityIdentifier("product-search")
                            Picker("Categoría",selection:$categoryID) {
                                Text("Todas").tag("")
                                ForEach(categories.filter(\.active)) { Text($0.name).tag($0.id) }
                            }
                            if visibleProducts.isEmpty && !loading { Text("No hay productos disponibles con este filtro.").foregroundStyle(.secondary) }
                            ForEach(visibleProducts) { product in
                                VStack(alignment:.leading,spacing:12) {
                                    HStack {
                                        VStack(alignment:.leading,spacing:5) {
                                            Text(product.name).fontWeight(.semibold)
                                            if !product.description.isEmpty { Text(product.description).font(.caption).foregroundStyle(.secondary) }
                                            Text("Precio unitario: \(money(product.priceCents))").font(.subheadline)
                                        }
                                        Spacer()
                                        Button { add(product) } label: { Image(systemName:"plus.circle.fill").font(.title2) }
                                            .buttonStyle(.borderless).accessibilityLabel("Agregar \(product.name)").accessibilityIdentifier("add-\(product.id)")
                                            .disabled(lines.count >= 100 && !lines.contains { $0.productId == product.id } || lines.first { $0.productId == product.id }?.quantity == 100)
                                    }
                                    if let line = lines.first(where: { $0.productId == product.id }) {
                                        Stepper("En tu pedido: \(line.quantity)",value:quantityBinding(product.id),in:1...100)
                                        productNote(line)
                                    }
                                }.padding(.vertical,6)
                            }
                            Button("Actualizar menú") { Task { await load() } }.disabled(loading)
                        }
                    }
                    if reviewing || frozen {
                        Section("Tu pedido · \(currentLines.reduce(0){$0 + $1.quantity}) productos") {
                            if currentLines.isEmpty { Text("Agrega productos del menú para empezar.").foregroundStyle(.secondary) }
                            ForEach(currentLines,id:\.productId) { line in
                                VStack(alignment:.leading,spacing:10) {
                                    Text(products.first { $0.id == line.productId }?.name ?? "Producto del envío pendiente").font(.headline)
                                    if let product = products.first(where: { $0.id == line.productId }) {
                                        LabeledContent("Precio unitario",value:money(product.priceCents)).font(.subheadline)
                                            .accessibilityElement(children:.ignore).accessibilityLabel("Precio unitario").accessibilityValue(money(product.priceCents))
                                            .accessibilityIdentifier("unit-price-\(line.productId)")
                                        LabeledContent("Subtotal · \(line.quantity) unidades",value:money(product.priceCents * line.quantity)).font(.subheadline.bold())
                                            .accessibilityElement(children:.ignore).accessibilityLabel("Subtotal de \(line.quantity) unidades").accessibilityValue(money(product.priceCents * line.quantity))
                                            .accessibilityIdentifier("line-subtotal-\(line.productId)")
                                        if pending != nil { Text("Referencia del menú actual; el total confirmado lo determina el servidor.").font(.caption).foregroundStyle(.secondary) }
                                    }
                                    if frozen {
                                        Text("Cantidad: \(line.quantity)")
                                        if !line.notes.isEmpty { Text(line.notes).font(.callout) }
                                    } else {
                                        Stepper("Cantidad: \(line.quantity)",value:quantityBinding(line.productId),in:1...100)
                                        productNote(line)
                                        Button("Quitar producto",role:.destructive) { lines.removeAll { $0.productId == line.productId } }.buttonStyle(.borderless)
                                    }
                                }.padding(.vertical,6)
                            }
                        }
                        Section(target.orderID == nil ? "Notas de la cuenta" : "Notas de esta ronda") {
                            if frozen { Text(pending?.body.notes ?? notes) }
                            else {
                                TextField("Indicaciones generales",text:$notes,axis:.vertical).lineLimit(2...5).accessibilityIdentifier("order-notes")
                                if notes.utf16.count > 500 { Text("Máximo 500 caracteres.").font(.caption).foregroundStyle(.red) }
                            }
                        }
                        Section {
                            if !frozen { Button("Seguir agregando productos") { reviewing = false } }
                            if currentLines.allSatisfy({ line in products.contains { $0.id == line.productId } }) { LabeledContent("Estimado de este envío",value:money(estimate)) }
                            Text("El servidor confirma los precios y el total al recibir el pedido. Esta acción no realiza un cobro.").font(.caption).foregroundStyle(.secondary)
                            if requiresReview {
                                Button("Actualizar cuenta y revisar cambios") { Task { await reviewChanges() } }.disabled(loading || !contextValid)
                            } else {
                                Button(store.sendingOrder ? "Enviando…" : pending != nil ? "Reintentar mismo envío" : "Revisar y enviar") { confirming = true }
                                    .disabled(store.sendingOrder || loading || !contextValid || !validOrderLines(currentLines,notes:pending?.body.notes ?? notes))
                                    .accessibilityIdentifier("send-order")
                            }
                        }
                    }
                }
            }
            .background(KeyboardDismissArea())
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge:.bottom) {
                if !reviewing && !frozen {
                    Button("Revisar pedido · \(currentLines.reduce(0){$0 + $1.quantity}) productos") { reviewing = true }
                        .buttonStyle(.borderedProminent).controlSize(.large).frame(maxWidth:.infinity)
                        .padding().background(.bar).disabled(currentLines.isEmpty || loading).accessibilityIdentifier("review-order")
                }
            }
            .navigationTitle(target.orderID == nil ? "Tomar pedido" : "Agregar ronda")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement:.keyboard) {
                    Spacer()
                    Button("Ocultar teclado") { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder),to:nil,from:nil,for:nil) }
                        .accessibilityIdentifier("dismiss-keyboard")
                }
                ToolbarItem(placement:.cancellationAction) {
                Button(completed != nil ? "Cerrar" : pending != nil ? "Cerrar y conservar" : "Cancelar") {
                    if completed != nil || pending != nil || lines.isEmpty { dismiss() } else { discard = true }
                }.disabled(store.sendingOrder)
            } }
            .confirmationDialog("¿Descartar este borrador sin enviar?",isPresented:$discard,titleVisibility:.visible) { Button("Descartar borrador",role:.destructive) { dismiss() } }
            .confirmationDialog(pending != nil ? "¿Reintentar exactamente el mismo envío?" : "¿Enviar este pedido a cocina?",isPresented:$confirming,titleVisibility:.visible) {
                Button(pending != nil ? "Reintentar envío" : "Confirmar envío") { Task { await send() } }
            } message: { Text("\(target.tableName) · \(currentLines.reduce(0){$0 + $1.quantity}) productos") }
            .interactiveDismissDisabled(store.sendingOrder || (!lines.isEmpty && pending == nil && completed == nil))
            .task { await load() }
            .privacySensitive()
        }
    }
    private func productNote(_ line: OrderLineInput) -> some View {
        VStack(alignment:.leading,spacing:6) {
            Label("Nota para este producto",systemImage:"square.and.pencil").font(.subheadline.weight(.semibold))
            TextField("Ej. sin cebolla o bien cocido",text:noteBinding(line.productId),axis:.vertical)
                .lineLimit(2...4).padding(10).background(Color.primary.opacity(0.04),in:RoundedRectangle(cornerRadius:10))
                .accessibilityLabel("Nota para \(products.first { $0.id == line.productId }?.name ?? "este producto")")
                .accessibilityIdentifier("line-note-\(line.productId)")
            Text(line.notes.utf16.count > 300 ? "Máximo 300 caracteres por producto." : "Opcional · aplica a todas las unidades de este producto en el envío.")
                .font(.caption).foregroundStyle(line.notes.utf16.count > 300 ? Color.red : Color.secondary)
        }
    }
    private func quantityBinding(_ id: String) -> Binding<Int> {
        Binding(get:{ lines.first { $0.productId == id }?.quantity ?? 1 },set:{ value in
            if let index = lines.firstIndex(where:{ $0.productId == id }) { lines[index].quantity = value }
        })
    }
    private func noteBinding(_ id: String) -> Binding<String> {
        Binding(get:{ lines.first { $0.productId == id }?.notes ?? "" },set:{ value in
            if let index = lines.firstIndex(where:{ $0.productId == id }) { lines[index].notes = value }
        })
    }
    private func add(_ product: MenuProduct) {
        if let index = lines.firstIndex(where: { $0.productId == product.id }) { lines[index].quantity = min(100,lines[index].quantity + 1) }
        else if lines.count < 100 { lines.append(OrderLineInput(productId:product.id,quantity:1,notes:"")) }
    }
    private func load() async {
        loading = true
        defer { loading = false }
        do { let result = try await store.loadMenu(branchID:branchID,context:context); categories = result.0; products = result.1 }
        catch { message = error.localizedDescription }
    }
    private func send() async {
        message = nil
        do {
            completed = try await store.sendOrder(target:target,items:currentLines,notes:pending?.body.notes ?? notes,branchID:branchID,context:context)
        } catch {
            message = error.localizedDescription
            if store.pendingOrder == nil { requiresReview = true }
        }
    }
    private func reviewChanges() async {
        await store.refresh()
        await load()
        // Totals and table occupancy must be reviewed in their current screen before a new UUID is made.
        if store.error == nil { dismiss() }
        else { message = store.error }
    }
}
