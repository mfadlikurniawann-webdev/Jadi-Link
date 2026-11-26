import type { Metadata } from 'next';
import { Bebas_Neue, Host_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

// Host Grotesk stands in for Neue Montreal (commercial license required);
// Bebas Neue is used for large figures. Both are OFL and self-hosted by Next.
const sans = Host_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-host',
  display: 'swap',
});
const display = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Jadi Link — singkat tautannya, kenali kliknya.',
    template: '%s · Jadi Link',
  },
  description: 'Tautan pendek dengan analitik klik.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Lewati ke konten
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
