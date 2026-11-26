'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { getLocale, type Locale, setLocale, subscribeLocale } from './i18n';

export function useI18n() {
  const current = useSyncExternalStore(
    subscribeLocale,
    getLocale,
    () => 'id' as Locale,
  );
  const t = useCallback(
    (id: string, en: string) => (current === 'en' ? en : id),
    [current],
  );
  return { locale: current, setLocale, t };
}
