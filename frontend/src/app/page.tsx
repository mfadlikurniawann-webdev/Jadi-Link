'use client';

import { useI18n } from '@/lib/use-i18n';
import Link from 'next/link';
import { Brand } from '@/components/app-shell';
import { LanguageSwitch } from '@/components/language-switch';
import { Icon } from '@/components/icons';
import { LandingCursor } from '@/features/landing/cursor';
import { HeroCard } from '@/features/landing/hero-card';

export default function HomePage() {
  const { t } = useI18n();
  return (
    <div className="landing">
      <LandingCursor />
      <header className="landing-header">
        <Brand />
        <div className="flex items-center gap-1">
          <LanguageSwitch />
          <Link href="/login" className="button button-quiet button-small">
            {t('Masuk', 'Sign in')}
          </Link>
          <Link href="/register" className="button button-primary button-small">
            {t('Daftar', 'Sign up')}
          </Link>
        </div>
      </header>
      <main id="main-content" className="landing-hero">
        <div className="hero-copy stagger">
          <h1>
            <span>{t('Link jadi ringkas.', 'Links made short.')}</span>
            <em>{t('Data jadi jelas.', 'Data made clear.')}</em>
          </h1>
          <p>
            {t(
              'Persingkat URL, lalu lihat dari mana kliknya datang.',
              'Shorten a URL, then see where its clicks come from.',
            )}
          </p>
          <div className="hero-actions">
            <Link href="/register" className="button button-primary">
              {t('Mulai gratis', 'Start free')}
              <Icon name="arrow" width={18} />
            </Link>
            <Link href="/login" className="button button-secondary">
              {t('Masuk', 'Sign in')}
            </Link>
          </div>
        </div>
        <HeroCard />
      </main>
    </div>
  );
}
