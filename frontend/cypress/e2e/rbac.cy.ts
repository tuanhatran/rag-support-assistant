import type { Credentials } from '../support/helpers'

describe('Role-based access and isolation', () => {
  let user: Credentials

  beforeEach(() => {
    cy.registerUser('standard').then((created) => {
      user = created
    })
  })

  afterEach(() => cy.deleteUser(user))

  it('hides the Admin screen from regular users', () => {
    cy.visit('/')
    cy.get('nav[aria-label="Main navigation"]').should('be.visible').and('not.contain', 'Admin')
  })

  it('rejects admin endpoints for regular users', () => {
    for (const path of [
      '/api/admin/users',
      '/api/admin/connections',
      '/api/admin/audit',
      '/api/admin/feedback/stats',
    ]) {
      cy.request({ url: path, failOnStatusCode: false }).its('status').should('eq', 403)
    }
  })

  it('rejects protected endpoints without a session', () => {
    cy.clearCookies()
    for (const path of ['/api/auth/me', '/api/chat/sessions', '/api/documents', '/api/admin/users']) {
      cy.request({ url: path, failOnStatusCode: false }).its('status').should('eq', 401)
    }
  })

  it('keeps conversations private to their owner', () => {
    cy.seedConversation('My VPN is stuck on Connecting').then(({ sessionId }) => {
      cy.registerUser('standard').then((other) => {
        cy.request({ url: `/api/chat/sessions/${sessionId}`, failOnStatusCode: false })
          .its('status')
          .should('eq', 404)
        cy.request('/api/chat/sessions').its('body').should('have.length', 0)
        cy.deleteUser(other)
      })
    })
  })
})
