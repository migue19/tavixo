import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Tavixo', short_name: 'Tavixo', description: 'Tu restaurante, en sincronía', start_url: '/', display: 'standalone', background_color: '#f5f3ee', theme_color: '#123c35', lang: 'es', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
}
