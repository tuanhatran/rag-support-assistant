import type { Credentials } from '../support/helpers'

const openPrivacy = () => cy.get('nav[aria-label="Main navigation"]').contains('button', 'Privacy').click()

describe('Privacy screen', () => {
  let credentials: Credentials

  beforeEach(() => {
    cy.registerUser('standard').then((created) => {
      credentials = created
    })
  })

  afterEach(() => cy.deleteUser(credentials))

  it('shows the current policy and opens the full text', () => {
    cy.visit('/')
    openPrivacy()
    cy.get('.policy-row').should('have.length.at.least', 1)
    cy.get('.privacy-stamp').should('not.contain', 'Loading')
    cy.contains('button', 'Open full policy').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('[aria-label="Close policy"]').click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('exports the user data', () => {
    cy.intercept('GET', '/api/privacy/data').as('export')
    cy.visit('/')
    openPrivacy()
    cy.contains('button', 'Export data').click()
    cy.wait('@export').its('response.statusCode').should('eq', 200)
    cy.get('.inline-success').should('contain', 'Your export has been prepared.')
  })

  it('deletes the conversations', () => {
    cy.seedConversation('My VPN is stuck on Connecting')
    cy.visit('/')
    cy.get('.thread-row').should('have.length', 1)
    openPrivacy()
    cy.contains('button', 'Delete conversations').click()
    cy.get('.inline-success').should('contain', 'Deleted 1 conversations')
    cy.get('nav[aria-label="Main navigation"]').contains('button', 'AI Chat').click()
    cy.get('.rail-empty').should('contain', 'Your recent conversations will appear here.')
  })

  it('requires the correct password to delete the account', () => {
    cy.intercept('POST', '/api/privacy/account/delete').as('deleteAccount')
    cy.visit('/')
    openPrivacy()
    cy.contains('button', 'Delete account permanently').should('be.disabled')
    cy.contains('label', 'Confirm password').find('input').type('not-the-password', { log: false })
    cy.contains('button', 'Delete account permanently').click()
    cy.wait('@deleteAccount').its('response.statusCode').should('eq', 401)
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: credentials,
      log: false,
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 200)
  })

  it('deletes the account and returns to the login screen', () => {
    cy.visit('/')
    openPrivacy()
    cy.contains('label', 'Confirm password').find('input').type(credentials.password, { log: false })
    cy.contains('button', 'Delete account permanently').click()
    cy.contains('h2', 'Welcome back').should('be.visible')
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: credentials,
      log: false,
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 401)
  })
})
