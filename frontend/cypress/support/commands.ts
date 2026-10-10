import { adminCredentials, newCredentials } from './helpers'
import type { Credentials, Plan } from './helpers'

export interface SeededMessage {
  sessionId: string
  messageId: string
}

declare global {
  namespace Cypress {
    interface Chainable {
      /** Creates a unique account through the API and leaves its session cookie in the browser. */
      registerUser(plan?: Plan): Chainable<Credentials>
      /** Signs in through the API (cached with cy.session). */
      login(credentials: Credentials): Chainable<void>
      /** Signs in as the bootstrap admin from CYPRESS_ADMIN_USERNAME and CYPRESS_ADMIN_PASSWORD. */
      adminLogin(): Chainable<void>
      /** Accepts the blocking policy modal. */
      acceptPolicy(): Chainable<void>
      /** Asks one question through the API as the current user. */
      seedConversation(question: string): Chainable<SeededMessage>
      /** Best-effort account removal that never fails the test. */
      deleteUser(credentials: Credentials): Chainable<void>
    }
  }
}

function signIn({ username, password }: Credentials) {
  // Status is asserted instead of failOnStatusCode so a failure never prints the request body.
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { username, password },
    log: false,
    failOnStatusCode: false,
  }).then((response) => assertStatus(response, 200))
}

function assertStatus(response: Cypress.Response<unknown>, expected: number) {
  if (response.status === expected) return
  const requestIdHeader = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'x-request-id')?.[1]
  const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : 'unavailable'
  const server = response.headers.server ?? 'unavailable'
  const contentType = response.headers['content-type'] ?? 'unavailable'
  throw new Error(
    `Expected HTTP ${expected}, received ${response.status}; request ID ${requestId}; URL ${response.url}; server ${server}; content type ${contentType}`,
  )
}

Cypress.Commands.add('registerUser', (plan: Plan = 'standard') => {
  const credentials = newCredentials()
  cy.request({
    method: 'POST',
    url: '/api/auth/register',
    body: { ...credentials, plan, policy_accepted: true },
    log: false,
    failOnStatusCode: false,
  }).then((response) => assertStatus(response, 201))
  return cy.wrap(credentials, { log: false })
})

Cypress.Commands.add('login', (credentials: Credentials) => {
  cy.session(['user', credentials.username], () => signIn(credentials))
})

Cypress.Commands.add('adminLogin', () => {
  const credentials = adminCredentials()
  if (!credentials) throw new Error('Set CYPRESS_ADMIN_USERNAME and CYPRESS_ADMIN_PASSWORD.')
  cy.session(['admin', credentials.username], () => {
    signIn(credentials)
    cy.request({ method: 'POST', url: '/api/privacy/consent', body: { accepted: true }, log: false })
      .its('status')
      .should('eq', 200)
  })
})

Cypress.Commands.add('acceptPolicy', () => {
  cy.get('[role="dialog"]').contains('button', 'Accept policy').click()
  cy.get('[role="dialog"]').should('not.exist')
})

Cypress.Commands.add('seedConversation', (question: string) => {
  return cy
    .request('POST', '/api/chat/sessions')
    .its('body.id')
    .then((sessionId) =>
      cy
        .request('POST', `/api/chat/sessions/${sessionId}/messages`, { question })
        .then((response) => ({ sessionId: String(sessionId), messageId: String(response.body.id) })),
    )
})

Cypress.Commands.add('deleteUser', ({ username, password }: Credentials) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { username, password },
    log: false,
    failOnStatusCode: false,
  })
  cy.request({
    method: 'POST',
    url: '/api/privacy/account/delete',
    body: { password },
    log: false,
    failOnStatusCode: false,
  })
})
