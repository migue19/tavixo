import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Tavixo | Tu restaurante, en sincronía', description: 'Administración de restaurantes Tavixo', icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' }], apple: { url: '/apple-touch-icon.png', sizes: '180x180' } }, appleWebApp: { capable: true, title: 'Tavixo', statusBarStyle: 'default' } };
export const viewport: Viewport = { themeColor: '#A3432F' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
