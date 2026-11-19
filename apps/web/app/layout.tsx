import type { Metadata, Viewport } from 'next';
import { Montserrat, Roboto } from 'next/font/google';
import { fr } from '@twabibu/i18n';
import { SITE_URL } from '@/lib/env';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-montserrat', display: 'swap' });
const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Twabibu : prenez rendez-vous avec un soignant aux Comores', template: '%s | Twabibu' },
  description:
    'Trouvez un médecin, un dentiste, une sage-femme ou une pharmacie de garde à Ngazidja, Ndzuani et Mwali, et prenez rendez-vous en ligne.',
  applicationName: fr.brand.name,
  openGraph: { siteName: 'Twabibu', locale: 'fr_FR', type: 'website' },
};

export const viewport: Viewport = {
  themeColor: '#2A6BCB',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${roboto.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-primary"
        >
          {fr.header.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
