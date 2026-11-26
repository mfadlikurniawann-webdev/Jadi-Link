import Link from 'next/link';
import { Icon } from '@/components/icons';

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center"
    >
      <span className="eyebrow">404 / SALAH PERSIMPANGAN</span>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Halaman ini tidak ditemukan.
      </h1>
      <p className="mb-7 mt-4 text-muted">
        Coba kembali ke workspace untuk menemukan tautanmu.
      </p>
      <Link href="/dashboard" className="button button-primary">
        Ke workspace
        <Icon name="arrow" />
      </Link>
    </main>
  );
}
