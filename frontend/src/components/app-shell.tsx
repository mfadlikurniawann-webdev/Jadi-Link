'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { Icon } from './icons';
import { LoadingPage, Modal } from './ui';

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${inverse ? 'text-white' : ''}`}
      aria-label="Jadi Link — beranda"
    >
      <span className="brand-mark">
        <Icon name="link" width={23} height={23} />
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
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Navigasi utama">
          <Link href="/dashboard" className="nav-item active">
            <Icon name="grid" />
            Semua tautan
            <span className="nav-dot" />
          </Link>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <Icon name="help" />
            Panduan singkat
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-white/70">
            <Icon name="link" />
          </div>
          <p className="font-semibold">
            Singkat tautannya.
            <br />
            Panjangkan dampaknya.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Satu ruang sederhana untuk tautan dan cerita di balik setiap klik.
          </p>
        </div>
        <div className="sidebar-account">
          <div className="avatar">{user.email.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{user.email}</p>
            <p className="mt-1 text-[11px] text-muted">Ruang pribadi</p>
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
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="desktop-breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron" width={13} />
            <strong>
              {pathname === '/dashboard' ? 'Semua tautan' : 'Detail tautan'}
            </strong>
          </div>
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="flex items-center gap-3">
            <span className="session-pill">
              <span />
              Sesi aktif
            </span>
            <button
              className="icon-button mobile-logout"
              onClick={() => setHelp(true)}
              aria-label="Panduan singkat"
            >
              <Icon name="help" />
            </button>
            <button
              className="icon-button mobile-logout"
              onClick={logout}
              aria-label="Keluar"
            >
              <Icon name="logout" />
            </button>
            <span className="hidden text-xs text-muted sm:block">
              Dibuat untuk berbagi.
            </span>
          </div>
        </header>
        <main id="main-content" className="workspace-content" key={user.id}>
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Jadi Link — lebih pendek, lebih terukur.</span>
          <span>Analitik harian dalam UTC</span>
        </footer>
      </div>
      <Modal
        open={help}
        title="Tautan pendek, langkah sederhana."
        onClose={() => setHelp(false)}
      >
        <ol className="space-y-5 text-sm leading-6">
          <li>
            <strong>01. Buat tautan</strong>
            <p className="text-muted">
              Masukkan URL HTTP/HTTPS. Alias opsional dan tidak dapat diganti
              setelah dibuat.
            </p>
          </li>
          <li>
            <strong>02. Salin dan bagikan</strong>
            <p className="text-muted">
              Tautan nonaktif atau kedaluwarsa tidak akan meneruskan pengunjung.
            </p>
          </li>
          <li>
            <strong>03. Baca ceritanya</strong>
            <p className="text-muted">
              Klik tersimpan secara batch, jadi analitik dapat terlambat sekitar
              5 detik. Grafik menggunakan 30 hari kalender UTC.
            </p>
          </li>
        </ol>
        <div className="info-box mt-6">
          <Icon name="shield" />
          <p>
            Sesi hanya disimpan di memori. Refresh halaman atau masa token habis
            akan meminta kamu masuk lagi.
          </p>
        </div>
      </Modal>
    </div>
  );
}
