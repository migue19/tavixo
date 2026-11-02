import SwiftUI

extension Color {
    init(brandHex: String, fallback: Color = .primary) {
        let hex = brandHex.trimmingCharacters(in:CharacterSet(charactersIn:"#"))
        guard hex.count == 6, let value = UInt32(hex,radix:16) else { self = fallback; return }
        self.init(.sRGB,red:Double((value >> 16) & 255)/255,green:Double((value >> 8) & 255)/255,blue:Double(value & 255)/255,opacity:1)
    }
}
enum BrandTheme {
    static let primary = Color(brandHex:"A3432F")
    static let ink = Color(brandHex:"24211F")
    static let cream = Color(brandHex:"FAF6EF")
    static let maize = Color(brandHex:"EAB766")
    static let muted = Color(brandHex:"70665F")
    static func font(_ size: CGFloat, style: Font.TextStyle = .body, weight: Font.Weight = .medium) -> Font {
        .custom("Manrope-ExtraLight",size:size,relativeTo:style).weight(weight)
    }
}
struct BrandWordmark: View {
    var body: some View { Image("BrandLogo").resizable().scaledToFit().frame(width:193,height:48).accessibilityLabel("Tavixo") }
}
struct StatusPill: View {
    let order: RestaurantOrder
    private var tint: Color {
        switch order.status { case "READY": Color(brandHex:"246445"); case "PREPARING": Color(brandHex:"805100"); case "CANCELLED": Color(brandHex:"B42318"); case "CLOSED": BrandTheme.muted; default: Color(brandHex:"2455A4") }
    }
    var body: some View {
        Text(order.statusLabel).font(.caption.weight(.semibold)).padding(.horizontal,10).padding(.vertical,6)
            .foregroundStyle(tint).background(tint.opacity(0.12),in:Capsule())
    }
}
struct RestaurantAvatar: View {
    let restaurant: Restaurant
    var body: some View {
        Group {
            if let raw = restaurant.branding?.logo, raw.hasPrefix("data:image/png;base64,"), raw.count <= 350000,
               let data = Data(base64Encoded:String(raw.dropFirst("data:image/png;base64,".count))), let image = UIImage(data:data) {
                Image(uiImage:image).resizable().scaledToFit()
            } else if let raw = restaurant.branding?.logo, raw.hasPrefix("/branding/"), !raw.contains(".."),
                      let url = URL(string:raw,relativeTo:APIClient.productionURL), url.host == APIClient.productionURL.host {
                AsyncImage(url:url) { image in image.resizable().scaledToFit() } placeholder: { fallback }
            } else { fallback }
        }.frame(width:54,height:54).padding(6).background(.white,in:RoundedRectangle(cornerRadius:12)).accessibilityLabel("Logo de \(restaurant.name)")
    }
    private var fallback: some View { Image(systemName:"fork.knife").font(.title2).foregroundStyle(BrandTheme.primary) }
}
