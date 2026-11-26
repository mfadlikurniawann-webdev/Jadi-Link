'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { Icon } from './icons';
import { LoadingPage, Modal } from './ui';

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Jadi Link — beranda">
      <span className="brand-mark">
        <Icon name="link" width={19} height={19} />
      </span>
      <span>
        jadi<span className="font-normal">link</span>
        <span className="text-accent">.</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, reason, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
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
          <nav className="topbar-nav" aria-label="Navigasi utama">
            <Link
              href="/dashboard"
              className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
            >
              <Icon name="grid" />
              Tautan
            </Link>
          </nav>
        </div>
        <div className="topbar-account">
          <button
            className="icon-button"
            onClick={() => setHelp(true)}
            aria-label="Panduan singkat"
            title="Panduan"
          >
            <Icon name="help" />
          </button>
          <span className="topbar-email ml-2 max-w-52 truncate text-xs text-muted">
            {user.email}
          </span>
          <div className="avatar ml-2" aria-hidden="true">
            {user.email.slice(0, 1).toUpperCase()}
          </div>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Keluar"
            title="Keluar"
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main id="main-content" className="workspace-content" key={user.id}>
        {children}
      </main>
      <Modal open={help} title="Panduan" onClose={() => setHelp(false)}>
        <ol className="space-y-3 text-sm leading-6 text-[#b8b8b8]">
          <li>
            <strong className="text-white">1.</strong> Buat tautan dari URL
            HTTP/HTTPS.
          </li>
          <li>
            <strong className="text-white">2.</strong> Salin dan bagikan.
          </li>
          <li>
            <strong className="text-white">3.</strong> Lihat analitik di detail
            tautan (jeda ±5 detik, UTC).
          </li>
        </ol>
        <p className="mt-5 text-xs text-muted">
          Sesi hanya di memori — refresh berarti login ulang.
        </p>
      </Modal>
    </div>
  );
}
