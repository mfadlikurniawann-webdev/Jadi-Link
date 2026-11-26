import type { ShortLink } from './types';

export const number = (value: number) =>
  new Intl.NumberFormat('id-ID').format(value);

export function dateTime(value: string | null): string {
  if (!value) return 'Tanpa batas waktu';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : 'Tanggal tidak valid';
}

export function dayLabel(value: string, detailed = false): string {
  return new Intl.DateTimeFormat('id-ID', {
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
  if (!code) return 'Tidak diketahui';
  try {
    return new Intl.DisplayNames(['id'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}
