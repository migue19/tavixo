import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Tavixo | Tu restaurante, en sincronía', description: 'Administración de restaurantes Tavixo', appleWebApp: { capable: true, title: 'Tavixo', statusBarStyle: 'default' } };
export const viewport: Viewport = { themeColor: '#123c35' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
