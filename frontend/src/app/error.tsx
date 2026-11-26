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
      <h1 className="mb-6 mt-5 text-3xl font-bold">Terjadi kesalahan.</h1>
      <button className="button button-primary" onClick={reset}>
        Coba lagi
        <Icon name="refresh" />
      </button>
    </main>
  );
}
