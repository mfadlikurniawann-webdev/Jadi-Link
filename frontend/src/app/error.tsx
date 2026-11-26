'use client';

import { Icon } from '@/components/icons';
import { useI18n } from '@/lib/use-i18n';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center"
    >
      <Icon name="alert" width={36} height={36} />
      <h1 className="mb-6 mt-5 text-3xl font-medium">
        {t('Terjadi kesalahan.', 'Something went wrong.')}
      </h1>
      <button className="button button-primary" onClick={reset}>
        {t('Coba lagi', 'Try again')}
        <Icon name="refresh" />
      </button>
    </main>
  );
}
