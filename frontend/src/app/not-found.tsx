import Link from 'next/link';
import { Icon } from '@/components/icons';

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center"
    >
      <span className="text-7xl font-extrabold tracking-tighter text-accent">
        404
      </span>
      <h1 className="mb-7 mt-3 text-2xl font-bold tracking-tight">
        Halaman tidak ditemukan.
      </h1>
      <Link href="/dashboard" className="button button-primary">
        Ke workspace
        <Icon name="arrow" />
      </Link>
    </main>
  );
}
