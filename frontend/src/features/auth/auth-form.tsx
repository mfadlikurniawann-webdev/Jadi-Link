'use client';

import { useI18n } from '@/lib/use-i18n';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/app-shell';
import { LanguageSwitch } from '@/components/language-switch';
import { useAuth } from '@/components/auth-provider';
import { Icon } from '@/components/icons';
import { ErrorBox, LoadingPage, Spinner } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';
import { safeReturnTo, validateCredentials } from '@/lib/validation';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const register = mode === 'register';
  const { t } = useI18n();
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
      <div className="auth-top">
        <Brand />
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <Link href="/" className="back-link">
            <Icon name="back" width={16} /> {t('Beranda', 'Home')}
          </Link>
        </div>
      </div>
      <main className="auth-card animate-enter" id="main-content">
        <h1>
          {register
            ? t('Buat akun baru.', 'Create your account.')
            : t('Masuk, lalu bagikan.', 'Sign in and share.')}
        </h1>
        {search.get('reason') === 'expired' && (
          <div className="info-box mb-5">
            <Icon name="clock" />
            <p>
              {t(
                'Sesimu sudah berakhir. Silakan masuk lagi.',
                'Your session has ended. Please sign in again.',
              )}
            </p>
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
              {t('Alamat email', 'Email address')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder={t('nama@email.com', 'name@email.com')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">
              {t('Kata sandi', 'Password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={visible ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'}
                className="input pr-12"
                placeholder={
                  register
                    ? t('Minimal 12 karakter', 'At least 12 characters')
                    : t('Kata sandimu', 'Your password')
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
                  visible
                    ? t('Sembunyikan kata sandi', 'Hide password')
                    : t('Tampilkan kata sandi', 'Show password')
                }
              >
                <Icon name="eye" width={18} />
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="button button-primary w-full justify-center py-3.5"
            disabled={busy}
          >
            {busy ? (
              <Spinner
                label={
                  register
                    ? t('Membuat akun…', 'Creating account…')
                    : t('Memeriksa akun…', 'Checking account…')
                }
              />
            ) : (
              <>
                {register
                  ? t('Buat akun', 'Create account')
                  : t('Masuk ke workspace', 'Sign in')}
                <Icon name="arrow" width={17} />
              </>
            )}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {register
            ? t('Sudah punya akun?', 'Already have an account?')
            : t('Baru di sini?', 'New here?')}{' '}
          <Link
            className="font-medium text-accent hover:underline"
            href={`${register ? '/login' : '/register'}?next=${encodeURIComponent(returnTo)}`}
          >
            {register
              ? t('Masuk', 'Sign in')
              : t('Buat akun', 'Create account')}
          </Link>
        </p>
      </main>
    </div>
  );
}
