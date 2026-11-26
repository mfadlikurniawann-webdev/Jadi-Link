export type Locale = 'id' | 'en';

const STORAGE_KEY = 'jadilink-lang';
const listeners = new Set<() => void>();
let locale: Locale = 'id';
let loaded = false;

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    // Only the UI language preference is stored; never auth data.
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'id' || saved === 'en') locale = saved;
  } catch {
    // Storage may be unavailable (private mode); keep the default.
  }
  document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  load();
  return locale;
}

export function setLocale(next: Locale) {
  load();
  if (next === locale) return;
  locale = next;
  try {
    if (typeof window !== 'undefined')
      window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage failures; the choice still applies to this tab.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}

/** Picks the string for the active locale (usable outside React). */
export function tr(id: string, en: string): string {
  return getLocale() === 'en' ? en : id;
}

export function intlLocale(): string {
  return getLocale() === 'en' ? 'en-US' : 'id-ID';
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
