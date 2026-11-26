'use client';

import type { Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/use-i18n';

const options: { value: Locale; label: string; name: string }[] = [
  { value: 'id', label: 'ID', name: 'Bahasa Indonesia' },
  { value: 'en', label: 'EN', name: 'English' },
];

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      className="lang-switch"
      role="group"
      aria-label={t('Bahasa', 'Language')}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-label={option.name}
          aria-pressed={locale === option.value}
          onClick={() => setLocale(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
