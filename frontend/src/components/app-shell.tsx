'use client';

import { useI18n } from '@/lib/use-i18n';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { LanguageSwitch } from './language-switch';
import { BrandMark, Icon } from './icons';
import { LoadingPage, Modal } from './ui';

export function Brand() {
  const { t } = useI18n();
  return (
    <Link
      href="/"
      className="brand"
      aria-label={t('jadi.click — beranda', 'jadi.click — home')}
    >
      <span className="brand-mark">
        <BrandMark />
      </span>
      <span>
        jadi<span className="text-accent">.</span>
        <span className="font-normal">click</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, reason, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
  const { t } = useI18n();
  useEffect(() => {
    if (!user)
      router.replace(
        `/login?next=${encodeURIComponent(pathname)}${reason ? '&reason=expired' : ''}`,
      );
  }, [user, reason, pathname, router]);
  if (!user) return <LoadingPage />;
  return (
    <div className="workspace">
      <header className="topbar">
        <div className="flex items-center gap-6">
          <Brand />
          <nav
            className="topbar-nav"
            aria-label={t('Navigasi utama', 'Main navigation')}
          >
            <Link
              href="/dashboard"
              className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
            >
              <Icon name="grid" />
              {t('Tautan', 'Links')}
            </Link>
          </nav>
        </div>
        <div className="topbar-account">
          <button
            className="icon-button"
            onClick={() => setHelp(true)}
            aria-label={t('Panduan singkat', 'Quick guide')}
            title={t('Panduan', 'Guide')}
          >
            <Icon name="help" />
          </button>
          <span className="topbar-email ml-2 max-w-52 truncate text-xs text-muted">
            {user.email}
          </span>
          <LanguageSwitch />
          <div className="avatar ml-2" aria-hidden="true">
            {user.email.slice(0, 1).toUpperCase()}
          </div>
          <button
            className="icon-button"
            onClick={logout}
            aria-label={t('Keluar', 'Sign out')}
            title={t('Keluar', 'Sign out')}
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main id="main-content" className="workspace-content" key={user.id}>
        {children}
      </main>
      <Modal
        open={help}
        title={t('Panduan', 'Guide')}
        onClose={() => setHelp(false)}
      >
        <ol className="space-y-3 text-sm leading-6 text-muted">
          <li>
            <strong className="text-ink">1.</strong>{' '}
            {t(
              'Buat tautan dari URL HTTP/HTTPS.',
              'Create a link from an HTTP/HTTPS URL.',
            )}
          </li>
          <li>
            <strong className="text-ink">2.</strong>{' '}
            {t('Salin dan bagikan.', 'Copy and share it.')}
          </li>
          <li>
            <strong className="text-ink">3.</strong>{' '}
            {t(
              'Lihat analitik di detail tautan (jeda ±5 detik, UTC).',
              'See analytics on the link detail page (±5 s delay, UTC).',
            )}
          </li>
        </ol>
        <p className="mt-5 text-xs text-muted">
          {t(
            'Sesi hanya di memori — refresh berarti login ulang.',
            'Session lives in memory only — refreshing signs you out.',
          )}
        </p>
      </Modal>
    </div>
  );
}
