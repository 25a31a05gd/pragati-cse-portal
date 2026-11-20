const AUTH_TOKEN_KEY = 'cse_dept_portal_token';
const REQUEST_TIMEOUT_MS = 25000;

function normalizeApiBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin.toLowerCase();
      const currentHost = window.location.hostname.toLowerCase();
      const targetHost = parsed.hostname.toLowerCase();

      // Same-origin URL should use relative /api/... requests
      if (parsed.origin.toLowerCase() === currentOrigin) {
        return '';
      }

      // In AI Studio preview (*.run.app), ignore misconfigured *.vercel.app URLs
      // so the app uses its own same-origin Express backend.
      if (currentHost.endsWith('.run.app') && targetHost.endsWith('.vercel.app')) {
        return '';
      }

      // On Vercel deployments, ignore stale cross-deployment *.vercel.app preview URLs
      // (which trigger Vercel SSO 302 redirects and CORS failures).
      if (
        currentHost.endsWith('.vercel.app') &&
        targetHost.endsWith('.vercel.app') &&
        targetHost !== currentHost
      ) {
        return '';
      }

      // Avoid mixed-content errors on HTTPS pages
      if (
        window.location.protocol === 'https:' &&
        parsed.protocol === 'http:' &&
        targetHost !== 'localhost' &&
        targetHost !== '127.0.0.1'
      ) {
        parsed.protocol = 'https:';
      }
    }

    let pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    if (pathname === '/api') {
      pathname = '';
    } else if (pathname.endsWith('/api')) {
      pathname = pathname.slice(0, -4);
    }
    return `${parsed.origin}${pathname}`;
  } catch {
    return '';
  }
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const providedHeaders = (options.headers as Record<string, string> | undefined) ?? {};
  const hasContentType = Object.keys(providedHeaders).some(
    (k) => k.toLowerCase() === 'content-type'
  );
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(hasBody && !isFormData && !hasContentType
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...providedHeaders,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
    if (timedOut) {
      throw new ApiError(
        'Backend server took too long to respond. If the backend is waking up from idle, please wait a moment and try again.',
        504
      );
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError(
      'Unable to reach the backend server. Please verify your internet connection or backend API / CORS configuration.',
      503
    );
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const serverError =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : '';
    throw new ApiError(serverError || `Request failed (${response.status})`, response.status);
  }
  if (data === null && contentType.includes('text/html')) {
    throw new ApiError(
      'Backend API route returned HTML instead of JSON. Please check VITE_API_BASE_URL and backend routing.',
      502
    );
  }
  return (data ?? {}) as T;
}

export function safeExternalHref(raw: string | null | undefined): string | undefined {
  const trimmed = (raw || '').trim();
  if (!trimmed) return undefined;

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

