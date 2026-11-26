'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { Icon } from '@/components/icons';
import { ErrorBox, LoadingPage, Spinner } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';
import { safeReturnTo, validateCredentials } from '@/lib/validation';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const register = mode === 'register';
  const { user, signIn } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = safeReturnTo(search.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (user) router.replace(returnTo);
  }, [user, returnTo, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateCredentials(email, password, register);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<AuthResponse>(`/auth/${mode}`, {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
      });
      signIn(response);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }
  if (user) return <LoadingPage />;
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand inverse />
        <div className="auth-story-copy">
          <span className="eyebrow text-accent">
            TAUTAN KECIL. KEMUNGKINAN BESAR.
          </span>
          <h2>
            Setiap tautan
            <br />
            punya <span>cerita.</span>
          </h2>
          <p>
            Persingkat jalannya. Kenali pengunjungnya.
            <br />
            Bagikan sesuatu yang berarti.
          </p>
          <div className="auth-preview">
            <span className="preview-dot" />
            <span>jadilink / ide-besarmu</span>
            <Icon name="arrow" />
          </div>
        </div>
        <div className="auth-story-footer">
          <span>SEDERHANA SEJAK KLIK PERTAMA</span>
          <span>01 / 03</span>
        </div>
      </aside>
      <main className="auth-main" id="main-content">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <Link href="/" className="back-link">
          <Icon name="back" width={16} /> Kembali ke beranda
        </Link>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {register ? 'MULAI SESUATU YANG BAIK' : 'SELAMAT DATANG KEMBALI'}
          </span>
          <h1>
            {register ? 'Ruang baru untuk tautanmu.' : 'Masuk, lalu bagikan.'}
          </h1>
          <p className="mb-7 mt-3 text-sm leading-6 text-muted">
            {register
              ? 'Buat akun untuk merapikan tautan dan melihat setiap kliknya.'
              : 'Tautanmu sudah menunggu. Lanjutkan dari sini.'}
          </p>
          {search.get('reason') === 'expired' && (
            <div className="info-box mb-5">
              <Icon name="clock" />
              <p>Sesimu sudah berakhir. Silakan masuk lagi.</p>
            </div>
          )}
          {error && (
            <div className="mb-5">
              <ErrorBox error={error} />
            </div>
          )}
          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <div>
              <label htmlFor="email" className="field-label">
                Alamat email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                placeholder="nama@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Kata sandi
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  className="input pr-12"
                  placeholder={
                    register ? 'Minimal 12 karakter' : 'Kata sandimu'
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                  }
                >
                  <Icon name="eye" width={18} />
                </button>
              </div>
              {register && (
                <p className="field-hint">
                  Minimal 12 karakter, maksimal 72 byte UTF-8. Spasi tidak
                  dihapus.
                </p>
              )}
            </div>
            <button
              type="submit"
              className="button button-primary w-full justify-center py-3.5"
              disabled={busy}
            >
              {busy ? (
                <Spinner
                  label={register ? 'Membuat akun…' : 'Memeriksa akun…'}
                />
              ) : (
                <>
                  {register ? 'Buat akun' : 'Masuk ke workspace'}
                  <Icon name="arrow" width={17} />
                </>
              )}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            {register ? 'Sudah punya akun?' : 'Baru di sini?'}{' '}
            <Link
              className="font-semibold text-ink underline underline-offset-4"
              href={`${register ? '/login' : '/register'}?next=${encodeURIComponent(returnTo)}`}
            >
              {register ? 'Masuk' : 'Buat akun'}
            </Link>
          </p>
          <div className="mt-9 border-t border-line pt-5 text-xs leading-5 text-muted">
            <span className="flex items-center gap-2">
              <Icon name="shield" width={14} />
              Token hanya di memori, bukan browser storage.
            </span>
            <p className="mt-2">
              Refresh halaman meminta login ulang. Sesi berlaku hingga token
              berakhir.
            </p>
          </div>
        </div>
        <span className="auth-copyright">
          Jadi Link © {new Date().getFullYear()}
        </span>
      </main>
    </div>
  );
}
