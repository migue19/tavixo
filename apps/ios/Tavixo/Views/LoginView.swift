import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var store: AppStore
    @State private var restaurant = ""
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Field?
    private enum Field { case restaurant, email, password }
    var body: some View {
        ScrollView {
            VStack(alignment:.leading,spacing:28) {
                BrandWordmark().padding(.top,24)
                VStack(alignment:.leading,spacing:16) {
                    Text("TU OPERACIÓN, CONECTADA").font(.caption.weight(.bold)).foregroundStyle(BrandTheme.maize)
                    Text("Tu restaurante,\nen sincronía.").font(BrandTheme.font(34,style:.largeTitle,weight:.heavy)).foregroundStyle(BrandTheme.cream)
                    Text("Mesas, cocina y caja en un mismo lugar.").foregroundStyle(BrandTheme.cream.opacity(0.85))
                }.padding(24).frame(maxWidth:.infinity,alignment:.leading).background(BrandTheme.ink,in:RoundedRectangle(cornerRadius:24))
                VStack(alignment:.leading,spacing:18) {
                    Text("Bienvenido").font(BrandTheme.font(25,style:.title2,weight:.bold))
                    Text("Ingresa con tu cuenta de Tavixo.").foregroundStyle(BrandTheme.muted)
                    entry("Restaurante") { TextField("Ej. mi-restaurante",text:$restaurant).textInputAutocapitalization(.never).autocorrectionDisabled().focused($focus,equals:.restaurant).submitLabel(.next).onSubmit { focus = .email }.accessibilityIdentifier("restaurant-field") }
                    entry("Correo") { TextField("Tu correo",text:$email).keyboardType(.emailAddress).textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled().focused($focus,equals:.email).submitLabel(.next).onSubmit { focus = .password }.accessibilityIdentifier("email-field") }
                    entry("Contraseña") { SecureField("Tu contraseña",text:$password).textContentType(.password).focused($focus,equals:.password).submitLabel(.go).onSubmit { signIn() }.accessibilityIdentifier("password-field") }
                    if let error = store.error { Text(error).foregroundStyle(.red).font(.callout).accessibilityAddTraits(.updatesFrequently) }
                    Button(action:signIn) {
                        HStack { if store.authBusy { ProgressView().tint(.white) }; Text(store.authBusy ? "Ingresando…" : "Entrar a mi restaurante").fontWeight(.bold) }.frame(maxWidth:.infinity).frame(minHeight:44)
                    }.buttonStyle(.borderedProminent).disabled(store.authBusy || restaurant.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty || email.isEmpty || password.isEmpty).accessibilityIdentifier("login-button")
                }.padding(24).background(.white,in:RoundedRectangle(cornerRadius:24))
                #if DEBUG
                Button("Explorar demo local") { password = ""; store.startDemo() }.frame(maxWidth:.infinity,minHeight:44).disabled(store.authBusy).accessibilityIdentifier("demo-button")
                #endif
                VStack(alignment:.leading,spacing:12) {
                    Text("¿Por qué Tavixo?").font(BrandTheme.font(22,style:.title3,weight:.bold))
                    Text("Un nombre de marca creado para conectar mesas, cocina, caja y gestión. La X de nuestro logo representa ese encuentro.")
                    Text("Nuestro objetivo").fontWeight(.bold)
                    Text("Ayudar a los restaurantes a trabajar con más orden, visibilidad y confianza, desde la primera comanda hasta el cierre de caja.")
                }.foregroundStyle(BrandTheme.muted).padding(.bottom,28)
            }.padding(.horizontal,24).frame(maxWidth:560).frame(maxWidth:.infinity)
        }.background(BrandTheme.cream).background(KeyboardDismissArea()).scrollDismissesKeyboard(.interactively)
    }
    private func entry<Content: View>(_ title: String, @ViewBuilder field: () -> Content) -> some View {
        VStack(alignment:.leading,spacing:8) { Text(title).font(.subheadline.weight(.semibold)); field().padding(14).background(BrandTheme.cream,in:RoundedRectangle(cornerRadius:10)).overlay(RoundedRectangle(cornerRadius:10).stroke(BrandTheme.muted.opacity(0.5))) }
    }
    private func signIn() {
        guard !store.authBusy, !restaurant.isEmpty, !email.isEmpty, !password.isEmpty else { return }
        focus = nil
        Task { await store.login(restaurant:restaurant,email:email,password:password); password = "" }
    }
}
