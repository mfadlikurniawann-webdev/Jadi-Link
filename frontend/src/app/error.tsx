'use client';

import { Icon } from '@/components/icons';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center"
    >
      <Icon name="alert" width={36} height={36} />
      <h1 className="mt-5 text-3xl font-semibold">
        Ada yang perlu dimuat ulang.
      </h1>
      <p className="mb-6 mt-3 text-muted">
        Kami tidak dapat menampilkan halaman ini. Coba sekali lagi.
      </p>
      <button className="button button-primary" onClick={reset}>
        Coba lagi
        <Icon name="refresh" />
      </button>
    </main>
  );
}
