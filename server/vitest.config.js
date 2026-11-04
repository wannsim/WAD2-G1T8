import { defineConfig } from 'vitest/config'

// Vitest settings (unit tests of plain functions - no database, no network).
//   cd server && pnpm test
// Only looks in __tests__ folders; the older node:test files in tests/ run with: pnpm test:node
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.spec.js'],
    exclude: ['node_modules/**', 'tests/**'],
  },
})
