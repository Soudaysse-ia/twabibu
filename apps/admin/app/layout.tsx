import type { Metadata, Viewport } from 'next';
import { Montserrat, Roboto } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-montserrat', display: 'swap' });
const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto', display: 'swap' });

export const metadata: Metadata = { title: { default: 'Back-office Twabibu', template: '%s | Back-office Twabibu' }, robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#2A6BCB', colorScheme: 'light', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${roboto.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-primary">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
