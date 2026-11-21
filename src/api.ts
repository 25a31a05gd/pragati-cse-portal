const AUTH_TOKEN_KEY = 'cse_dept_portal_token';
const REQUEST_TIMEOUT_MS = 25000;
const DEFAULT_PRODUCTION_RENDER_API_URL = 'https://pragati-cse-portal-1.onrender.com';

function isDedicatedBackendHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.onrender.com') ||
    host.endsWith('.run.app')
  );
}

function normalizeApiBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let trimmed = raw.trim().replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');
  if (!trimmed) return '';

  if (
    !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) &&
    /^[a-zA-Z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(trimmed)
  ) {
    const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed);
    trimmed = `${isLocalHost ? 'http' : 'https'}://${trimmed}`;
  }

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

      // Never use any *.vercel.app URL (including obsolete Vercel Preview deployments)
      // as the backend API base URL. Dedicated backend hosts use same-origin (''),
      // while static/Vercel frontends fall back to the Render production backend.
      if (targetHost.endsWith('.vercel.app')) {
        return isDedicatedBackendHost(currentHost)
          ? ''
          : DEFAULT_PRODUCTION_RENDER_API_URL;
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
    } else if (parsed.hostname.toLowerCase().endsWith('.vercel.app')) {
      return DEFAULT_PRODUCTION_RENDER_API_URL;
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

function resolveEffectiveApiBaseUrl(): string {
  const configured = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname.toLowerCase();
    // Same-origin only applies on local dev, AI Studio sandboxes, or the Render host itself.
    // On Vercel (*.vercel.app) or standalone static production domains, do not silently fall back
    // to a broken relative /api/* serverless endpoint when VITE_API_BASE_URL is unset at build time.
    if (currentHost.endsWith('.vercel.app') || (import.meta.env.PROD && !isDedicatedBackendHost(currentHost))) {
      return DEFAULT_PRODUCTION_RENDER_API_URL;
    }
  }

  return '';
}

export const API_BASE_URL = resolveEffectiveApiBaseUrl();

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

function getTargetOriginForDisplay(resolvedUrl: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return new URL(resolvedUrl, window.location.origin).origin;
  } catch {
    return '';
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

  const resolvedUrl = resolveApiUrl(path);
  const targetOrigin = getTargetOriginForDisplay(resolvedUrl);

  let response: Response;
  try {
    response = await fetch(resolvedUrl, {
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
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiError(
        'You appear to be offline. Please check your internet connection and try again.',
        503
      );
    }
    if (
      typeof window !== 'undefined' &&
      targetOrigin &&
      targetOrigin !== window.location.origin
    ) {
      throw new ApiError(
        `Unable to reach the backend API (${targetOrigin}). Please verify network connectivity or confirm ${window.location.origin} is allowed by backend CORS.`,
        503
      );
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
  const rawText = await response.text().catch(() => '');
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  const looksLikeHtml =
    contentType.includes('text/html') || rawText.trimStart().startsWith('<');

  if (!response.ok) {
    const serverError =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : '';
    if (serverError) {
      throw new ApiError(serverError, response.status);
    }
    if (looksLikeHtml) {
      throw new ApiError(
        `Backend API returned HTTP ${response.status} HTML instead of JSON${targetOrigin ? ` from ${targetOrigin}` : ''}. Please verify backend routing or server status.`,
        response.status
      );
    }
    throw new ApiError(`Request failed with HTTP ${response.status}.`, response.status);
  }

  if (response.status === 204 || !rawText.trim()) {
    return {} as T;
  }

  if (data === null) {
    if (looksLikeHtml) {
      throw new ApiError(
        'Backend API route returned HTML instead of JSON. Please check VITE_API_BASE_URL and backend routing.',
        502
      );
    }
    throw new ApiError(
      'Backend API returned an invalid non-JSON response.',
      502
    );
  }

  return data as T;
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

