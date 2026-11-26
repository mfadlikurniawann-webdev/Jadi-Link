export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter: number | null = null,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

export function resolveApiUrl(
  value: string | undefined,
  production = false,
): string {
  if (!value && production)
    throw new Error('NEXT_PUBLIC_API_URL is required for a production build.');
  const url = new URL(value || 'http://localhost:3001/api');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, '') !== '/api'
  )
    throw new Error(
      'NEXT_PUBLIC_API_URL must be an HTTP(S) URL ending in /api, without credentials/query/hash.',
    );
  if (
    production &&
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error('A remote production NEXT_PUBLIC_API_URL must use HTTPS.');
  }
  return url.href.replace(/\/$/, '');
}

const API_URL = resolveApiUrl(
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NODE_ENV === 'production',
);

const messages: Record<string, string> = {
  'Invalid email or password': 'Email atau kata sandi tidak cocok.',
  'Email is already registered': 'Email sudah terdaftar. Silakan masuk.',
  'Alias is already in use': 'Alias sudah digunakan. Coba alias lain.',
  'alias is reserved': 'Alias ini dicadangkan untuk sistem.',
  'targetUrl cannot point to the short-link hostname':
    'URL tujuan tidak boleh mengarah ke domain short link sendiri.',
};

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Terjadi kendala. Silakan coba lagi.';
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('API paths must be local paths.');
  }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (response.status === 204) return undefined as T;
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const payload =
        data && typeof data === 'object'
          ? (data as Record<string, unknown>)
          : {};
      const raw =
        typeof payload.message === 'string'
          ? payload.message
          : Array.isArray(payload.message)
            ? payload.message
                .filter((item) => typeof item === 'string')
                .join(' ')
            : '';
      const retry = Number(response.headers.get('Retry-After'));
      const retryAfter =
        response.headers.has('Retry-After') &&
        Number.isSafeInteger(retry) &&
        retry >= 0
          ? retry
          : null;
      const message =
        response.status >= 500
          ? 'Server sedang mengalami kendala. Silakan coba lagi.'
          : response.status === 429
            ? `Terlalu banyak permintaan. Coba lagi ${retryAfter === null ? 'sebentar lagi' : `dalam ${Math.max(1, retryAfter)} detik`}.`
            : messages[raw] || raw || 'Permintaan tidak dapat diproses.';
      throw new ApiError(
        response.status,
        message,
        retryAfter,
        typeof payload.requestId === 'string' ? payload.requestId : undefined,
      );
    }
    if (data === null)
      throw new ApiError(502, 'Respons server tidak dapat dibaca.');
    return data as T;
  } catch (error) {
    if (timedOut)
      throw new ApiError(0, 'Koneksi terlalu lama. Silakan coba lagi.');
    if (options.signal?.aborted)
      throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      'Tidak dapat terhubung ke API. Periksa koneksi dan pastikan backend berjalan.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
