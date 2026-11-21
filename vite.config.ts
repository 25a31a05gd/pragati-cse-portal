import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function sanitizeBuildApiBaseUrl(raw: string | undefined): string {
  const trimmed = (raw || '').trim().replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');
  if (!trimmed) return '';
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    // Never embed any *.vercel.app preview/frontend URL into compiled bundles as the backend API base.
    if (parsed.hostname.toLowerCase().endsWith('.vercel.app')) {
      return '';
    }
    return trimmed;
  } catch {
    return '';
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
