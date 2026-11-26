import { intlLocale, tr } from './i18n';
import type { ShortLink } from './types';

export const number = (value: number) =>
  new Intl.NumberFormat(intlLocale()).format(value);

export function dateTime(value: string | null): string {
  if (!value) return tr('Tanpa batas waktu', 'No expiry');
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(intlLocale(), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : tr('Tanggal tidak valid', 'Invalid date');
}

export function dayLabel(value: string, detailed = false): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month: detailed ? 'long' : 'short',
    timeZone: 'UTC',
    ...(detailed ? { year: 'numeric' as const } : {}),
  }).format(new Date(`${value}T00:00:00Z`));
}

export function linkStatus(
  link: ShortLink,
  now = Date.now(),
): 'active' | 'inactive' | 'expired' {
  if (!link.isActive) return 'inactive';
  return link.expiresAt && Date.parse(link.expiresAt) <= now
    ? 'expired'
    : 'active';
}

export function displayUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
}

export function countryName(code: string | null): string {
  if (!code) return tr('Tidak diketahui', 'Unknown');
  try {
    return (
      new Intl.DisplayNames([intlLocale()], { type: 'region' }).of(code) || code
    );
  } catch {
    return code;
  }
}
