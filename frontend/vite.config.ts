import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './node_modules/.cache/vitest-coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/types.ts', 'src/types/**', 'src/**/*.d.ts'],
      thresholds: { statements: 85, branches: 85, functions: 85, lines: 85 },
    },
  },
})
