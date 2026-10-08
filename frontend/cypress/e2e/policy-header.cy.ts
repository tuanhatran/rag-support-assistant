import type { Credentials } from '../support/helpers'

describe('Header and policy modal', () => {
  let credentials: Credentials

  beforeEach(() => {
    cy.registerUser('standard').then(created => { credentials = created })
  })

  afterEach(() => cy.deleteUser(credentials))

  it('shows brand, navigation, model badge and user chip', () => {
    cy.visit('/')
    cy.get('.brand').should('contain', 'fieldnote')
    cy.get('nav[aria-label="Main navigation"] button').then($buttons => {
      expect($buttons.toArray().map(button => button.textContent)).to.deep.equal(['AI Chat', 'Documents', 'Privacy'])
    })
    cy.get('.model-badge').should('not.be.empty').and('not.contain', 'Model not assigned')
    cy.get('.user-chip').should('contain', credentials.username).and('contain', 'standard | user')
  })

  it('navigates between the screens', () => {
    cy.visit('/')
    cy.contains('h1', 'How can we help?').should('be.visible')
    cy.get('nav[aria-label="Main navigation"]').contains('button', 'Documents').click()
    cy.contains('h1', 'Support documents').should('be.visible')
    cy.get('nav[aria-label="Main navigation"]').contains('button', 'Privacy').click()
    cy.contains('h1', 'Privacy & data').should('be.visible')
    cy.get('nav[aria-label="Main navigation"]').contains('button', 'AI Chat').click()
    cy.contains('h1', 'How can we help?').should('be.visible')
  })

  it('signs out and closes the session', () => {
    cy.visit('/')
    cy.get('button[aria-label="Sign out"]').click()
    cy.contains('h2', 'Welcome back').should('be.visible')
    cy.request({ url: '/api/auth/me', failOnStatusCode: false }).its('status').should('eq', 401)
  })

  it('blocks the app until the policy is accepted', () => {
    cy.intercept('GET', '/api/auth/me', request => {
      request.continue(response => { response.body.policy_accepted = false })
    })
    cy.intercept('POST', '/api/privacy/consent').as('consent')
    cy.visit('/')
    cy.get('[role="dialog"]').should('be.visible').and('contain', 'You must accept the current policy to continue.')
    cy.get('[aria-label="Close policy"]').should('not.exist')
    cy.acceptPolicy()
    cy.wait('@consent').its('response.statusCode').should('eq', 200)
    cy.contains('h1', 'How can we help?').should('be.visible')
  })
})
