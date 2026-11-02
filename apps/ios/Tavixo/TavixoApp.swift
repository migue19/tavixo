import SwiftUI

@main struct TavixoApp: App {
    @State private var initialized = false
    @StateObject private var store = AppStore()
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            Group {
                switch store.screen {
                case .startup: VStack(spacing:24) { BrandWordmark(); ProgressView("Abriendo Tavixo…") }.frame(maxWidth:.infinity,maxHeight:.infinity).background(BrandTheme.cream)
                case .login: LoginView()
                case .recovery: RecoveryView()
                case .workspace: if let session = store.session { WorkspaceView(session:session) }
                }
            }.preferredColorScheme(.light).environmentObject(store).font(BrandTheme.font(16)).tint(BrandTheme.primary)
                .overlay { if scenePhase != .active { BrandTheme.cream.ignoresSafeArea().overlay { BrandWordmark() } } }
                .task {
                    guard !initialized else { return }; initialized = true
                    #if DEBUG
                    if ProcessInfo.processInfo.arguments.contains("-tavixo-demo") { store.startDemo(); return }
                    #endif
                    await store.restore()
                }
                .onChange(of:scenePhase) { _,phase in if phase == .active && store.session != nil { Task { await store.refresh() } } }
        }
    }
}
struct RecoveryView: View {
    @EnvironmentObject private var store: AppStore
    @State private var confirmForget = false
    var body: some View {
        VStack(spacing:24) {
            BrandWordmark()
            ContentUnavailableView("No se pudo recuperar la sesión",systemImage:"wifi.exclamationmark",description:Text(store.error ?? "Revisa tu conexión."))
            Button("Reintentar") { Task { await store.retryRestore() } }.buttonStyle(.borderedProminent)
            Button("Eliminar sesión de este dispositivo",role:.destructive) { confirmForget = true }
        }.padding(24).background(BrandTheme.cream).confirmationDialog("Eliminar la sesión local",isPresented:$confirmForget,titleVisibility:.visible) {
            Button("Eliminar sesión local",role:.destructive) { store.forgetLocalSession() }
        } message: { Text("Esto elimina la credencial guardada aquí. Sin conexión no podemos revocarla en el servidor.") }
    }
}
