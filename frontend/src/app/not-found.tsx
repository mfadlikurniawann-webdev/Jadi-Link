'use client';

import { useI18n } from '@/lib/use-i18n';
import Link from 'next/link';
import { Icon } from '@/components/icons';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center"
    >
      <span className="font-display text-8xl leading-none text-accent">
        404
      </span>
      <h1 className="mb-7 mt-3 text-2xl font-medium">
        {t('Halaman tidak ditemukan.', 'Page not found.')}
      </h1>
      <Link href="/dashboard" className="button button-primary">
        {t('Ke workspace', 'Go to workspace')}
        <Icon name="arrow" />
      </Link>
    </main>
  );
}
