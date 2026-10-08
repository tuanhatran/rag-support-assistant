import { defineConfig } from 'cypress'

// CYPRESS_BASE_URL overrides baseUrl, for example http://localhost:5173 for the Vite dev server.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8080',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    defaultCommandTimeout: 10000,
  },
})
