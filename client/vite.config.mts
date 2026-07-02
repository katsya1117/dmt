/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.DEV_PORT) || 3000,
    strictPort: false,
    host: true,
    open: false, // サンドボックス環境では外部ブラウザを開かない
    allowedHosts: true, // v0プレビュー等の外部ホストからのアクセスを許可
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  test: {
    projects: [
      {
        // ユニットテスト（hooks / 純粋関数）
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.stories.*'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['src/mocks/vitest-setup.ts'],
        },
      },
      {
        // Storybookコンポーネントテスト
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  }
});
