import { defineConfig } from 'cypress'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

// CYPRESS_BASE_URL overrides baseUrl, for example http://localhost:5173 for the Vite dev server.
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) loadEnvFile(envFile)

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8080',
    env: {
      ADMIN_USERNAME: process.env.CYPRESS_ADMIN_USERNAME,
      ADMIN_PASSWORD: process.env.CYPRESS_ADMIN_PASSWORD,
    },
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    defaultCommandTimeout: 10000,
  },
})
