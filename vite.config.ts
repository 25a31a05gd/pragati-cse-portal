import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_VERCEL_API_URL = 'https://pragati-cse-portal-yieo.vercel.app';
const DEPRECATED_OR_LOCKED_BACKEND_HOSTS = new Set([
  'pragati-cse-portal-1.onrender.com',
  'pragati-cse-portal-yieo-qlikn1mt6-kishore-6855.vercel.app',
]);

function sanitizeBuildApiBaseUrl(raw: string | undefined): string {
  const trimmed = (raw || '').trim().replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_VERCEL_API_URL;
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_VERCEL_API_URL;
    }
    if (DEPRECATED_OR_LOCKED_BACKEND_HOSTS.has(parsed.hostname.toLowerCase())) {
      return DEFAULT_VERCEL_API_URL;
    }
    return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''));
  } catch {
    return DEFAULT_VERCEL_API_URL;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, currentDir, '');
  const sanitizedApiBase = sanitizeBuildApiBaseUrl(
    process.env.VITE_API_BASE_URL ?? env.VITE_API_BASE_URL
  );

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(sanitizedApiBase),
    },
    resolve: {
      alias: {
        '@': path.resolve(currentDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
