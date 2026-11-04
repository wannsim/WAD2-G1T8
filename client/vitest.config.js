import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Vitest settings (unit, component and integration tests).
//   cd client && pnpm test
// Only looks in src/**/__tests__/ so it never runs the Playwright E2E files in tests/
// or the older node:test files there (those run with: pnpm test:node).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)), // same '@' as vite.config.js
    },
  },
  test: {
    environment: 'jsdom', // a pretend browser, so Vue components can be mounted
    include: ['src/**/__tests__/**/*.spec.js'],
    exclude: ['node_modules/**', 'tests/**'],
  },
})
