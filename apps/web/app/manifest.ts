import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Twabibu',
    short_name: 'Twabibu',
    description: 'Prenez rendez-vous avec un soignant aux Comores et trouvez les pharmacies de garde.',
    lang: 'fr',
    start_url: '/',
    display: 'standalone',
    background_color: '#E8EEF7',
    theme_color: '#2A6BCB',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
