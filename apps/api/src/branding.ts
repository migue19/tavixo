/** Curated defaults and validated tenant overrides. No remote image URLs. */
export type Branding = {
  key: string;
  logo: string | null;
  primary: string;
  accent: string;
  surface: string;
};
const hex = /^#[a-f0-9]{6}$/i;
export function restaurantBranding(slug: string, stored?: unknown): Branding | null {
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const value = stored as Record<string, unknown>;
    const logo = value.logo;
    if ([value.primary, value.accent, value.surface].every(c => typeof c === "string" && hex.test(c)) &&
      (logo === null || (typeof logo === "string" && (isUploadedLogo(logo) || logo === fallbackBranding(slug)?.logo)))) {
      return { key: slug, logo: logo as string | null, primary: value.primary as string, accent: value.accent as string, surface: value.surface as string };
    }
  }
  return fallbackBranding(slug);
}
function fallbackBranding(slug: string): Branding | null {
  if (slug === "birria-el-cachanilla") return { key: slug, logo: "/branding/birria-el-cachanilla.jpg", primary: "#0b0907", accent: "#d4a466", surface: "#f3e6d0" };
  if (slug === "bill-cochi-nada") return { key: slug, logo: "/branding/bill-cochi-nada.png", primary: "#075839", accent: "#eed9a7", surface: "#fffaf0" };
  return null;
}
export function isUploadedLogo(logo: string) {
  return logo.length <= 350000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(logo);
}
export function brandingDefaults(slug: string): Branding {
  return fallbackBranding(slug) ?? { key: slug, logo: null, primary: "#a3432f", accent: "#eab766", surface: "#faf6ef" };
}
export function brightness(color: string) {
  const rgb = color.slice(1).match(/../g)!.map(s => parseInt(s, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
export function contrast(a: string, b: string) {
  const x = brightness(a), y = brightness(b);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
}
