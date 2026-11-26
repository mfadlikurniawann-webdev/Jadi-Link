import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Jadi Link — singkat tautannya, kenali kliknya.',
    template: '%s · Jadi Link',
  },
  description:
    'Ruang sederhana untuk membuat tautan pendek dan membaca cerita di balik setiap klik.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <a href="#main-content" className="skip-link">
          Lewati ke konten
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
