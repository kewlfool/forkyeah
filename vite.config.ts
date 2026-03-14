import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const normalizeBasePath = (value: string): string => (value.endsWith('/') ? value : `${value}/`);
const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const base = normalizeBasePath(process.env.VITE_BASE_PATH ?? '/');
const outDir = process.env.VITE_OUT_DIR ?? 'dist';
const rootPath = base === '/' ? base : base.slice(0, -1);
const navigateFallbackAllowlist =
  base === '/'
    ? [/^\/(?:index\.html)?$/]
    : [new RegExp(`^${escapeForRegex(rootPath)}(?:\\/|\\/index\\.html)?$`)];

const resolveSoundsDirectory = (): string | null => {
  const soundsPath = resolve(process.cwd(), 'sounds');
  if (existsSync(soundsPath)) {
    return soundsPath;
  }

  return null;
};

const copySoundsPlugin = () => ({
  name: 'copy-timeless-sounds',
  apply: 'build' as const,
  writeBundle(options: { dir?: string }) {
    const source = resolveSoundsDirectory();
    if (!source) {
      return;
    }

    const targetDir = resolve(process.cwd(), options.dir ?? outDir, 'sounds');
    cpSync(source, targetDir, { recursive: true, force: true });
  }
});

export default defineConfig({
  base,
  server: {
    proxy: {
      '/api': 'http://localhost:8787'
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  },
  build: {
    outDir
  },
  plugins: [
    copySoundsPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png'
      ],
      manifest: {
        name: 'Forkyeah by Devious Design',
        short_name: 'Forkyeah',
        description: 'A minimalist recipe manager by Devious Design, designed for importing, organizing, and cooking.',
        start_url: base,
        display: 'standalone',
        background_color: '#f6f5f1',
        theme_color: '#1a1a1a',
        orientation: 'portrait',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackAllowlist
      },
      devOptions: {
        enabled: false
      }
    })
  ]
});
