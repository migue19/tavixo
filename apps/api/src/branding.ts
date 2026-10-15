/** Curated restaurant identities. Only local assets; never fetch ticket images remotely. */
export type Branding = {
  key: string;
  logo: string;
  primary: string;
  accent: string;
  surface: string;
};
export function restaurantBranding(slug: string): Branding | null {
  if (slug !== "birria-el-cachanilla") return null;
  return {
    key: "birria-el-cachanilla",
    logo: "/branding/birria-el-cachanilla.jpg",
    primary: "#0b0907",
    accent: "#d4a466",
    surface: "#f3e6d0",
  };
}
