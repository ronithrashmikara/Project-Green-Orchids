import './globals.css';
import { Providers } from './providers';
import { CookieConsent } from '@/components/CookieConsent';

export const metadata = {
  title: 'Project Green - Wholesale Trade',
  description: 'B2B Wholesale Trade Platform for Orchids',
  openGraph: {
    title: 'Orchids - Wholesale Trade',
    description: 'B2B Wholesale Trade Platform for Orchids — live catalogue, tier pricing and order-to-delivery tracking.',
    images: ['/hero-poster.jpg'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
