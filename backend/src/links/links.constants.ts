export const SHORT_CODE_LENGTH = 7;
// Avoid visually ambiguous characters: 0, 1, i, l, o, I, L, O.
export const SHORT_CODE_ALPHABET =
  '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_TARGET_URL_LENGTH = 2048;
export const ALIAS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
export const EXPIRATION_TIMEZONE_PATTERN = /T.*(?:Z|[+-]\d{2}:\d{2})$/;
export const RESERVED_ALIASES: ReadonlySet<string> = new Set([
  'api',
  'docs',
  'health',
  'auth',
  'users',
  'links',
  'redirect',
  'analytics',
  'admin',
  'login',
  'register',
  'logout',
  'assets',
  'static',
  'favicon',
  'robots',
]);
