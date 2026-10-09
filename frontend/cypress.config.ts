import { defineConfig } from 'cypress'
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'

const { parsed: rootEnv } = loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

// CYPRESS_BASE_URL overrides baseUrl, for example http://localhost:5173 for the Vite dev server.

export default defineConfig({
  env: {
    ADMIN_USERNAME: process.env.CYPRESS_ADMIN_USERNAME ?? rootEnv?.CYPRESS_ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.CYPRESS_ADMIN_PASSWORD ?? rootEnv?.CYPRESS_ADMIN_PASSWORD,
  },
  hosts: process.platform === 'win32' ? { localhost: '::1' } : undefined,
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
