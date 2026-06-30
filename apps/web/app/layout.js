import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Project Green - Wholesale Trade',
  description: 'B2B Wholesale Trade Platform for ORCHIDS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
