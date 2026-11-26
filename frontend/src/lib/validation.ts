import type { CreateLink, ShortLink, UpdateLink } from './types';

export const LINK_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeReturnTo(value: string | null): string {
  return value === '/dashboard' ||
    (value?.startsWith('/links/') && LINK_ID_PATTERN.test(value.slice(7)))
    ? value
    : '/dashboard';
}

export function validateCredentials(
  email: string,
  password: string,
  register: boolean,
): string | null {
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    email.trim().length > 254
  )
    return 'Masukkan alamat email yang valid.';
  if (!password) return 'Masukkan kata sandimu.';
  if (register && [...password].length < 12)
    return 'Kata sandi minimal 12 karakter.';
  if (new TextEncoder().encode(password).length > 72)
    return 'Kata sandi maksimal 72 byte UTF-8. Emoji bisa memakai lebih dari satu byte.';
  return null;
}

export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function linkPayload(
  values: { targetUrl: string; alias: string; expiresAt: string },
  existing?: ShortLink,
  now = Date.now(),
): CreateLink | UpdateLink {
  const targetUrl = values.targetUrl.trim();
  if (
    !safeHttpUrl(targetUrl) ||
    targetUrl.length > 2048 ||
    /[\r\n\\]/.test(targetUrl)
  ) {
    throw new Error(
      'Gunakan URL HTTP/HTTPS yang valid, tanpa kredensial, maksimal 2.048 karakter.',
    );
  }
  const payload: CreateLink | UpdateLink = existing
    ? targetUrl !== existing.targetUrl
      ? { targetUrl }
      : {}
    : { targetUrl };
  if (!existing && values.alias.trim()) {
    const alias = values.alias.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(alias))
      throw new Error(
        'Alias 3–64 karakter: huruf, angka, _ atau -, diawali huruf/angka.',
      );
    (payload as CreateLink).alias = alias;
  }
  const changedExpiry =
    !existing || values.expiresAt !== toLocalDateTime(existing.expiresAt);
  if (changedExpiry && values.expiresAt) {
    const date = new Date(values.expiresAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= now)
      throw new Error('Tanggal kedaluwarsa harus di masa depan.');
    payload.expiresAt = date.toISOString();
  } else if (existing && changedExpiry) payload.expiresAt = null;
  if (existing && Object.keys(payload).length === 0)
    throw new Error('Belum ada perubahan untuk disimpan.');
  return payload;
}
