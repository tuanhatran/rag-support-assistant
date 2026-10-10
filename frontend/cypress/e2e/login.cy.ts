import { newCredentials } from '../support/helpers'

const field = (label: string) => cy.contains('label', new RegExp(`^${label}`)).find('input')

describe('Login screen', () => {
  beforeEach(() => cy.visit('/'))

  it('shows the sign-in form by default and switches to account creation', () => {
    cy.contains('h2', 'Welcome back').should('be.visible')
    cy.contains('[role="tab"]', 'Sign in').should('have.attr', 'aria-selected', 'true')
    cy.contains('[role="tab"]', 'Create account').click()
    cy.contains('h2', 'Create your account').should('be.visible')
    cy.contains('[role="tab"]', 'Create account').should('have.attr', 'aria-selected', 'true')
    field('Confirm password').should('be.visible')
    cy.contains('[role="tab"]', 'Sign in').click()
    cy.contains('label', 'Confirm password').should('not.exist')
  })

  it('rejects wrong credentials', () => {
    const { username, password } = newCredentials()
    field('Username').type(username)
    field('Password').type(password, { log: false })
    cy.get('button.auth-submit').click()
    cy.get('[role="alert"]').should('contain', 'Invalid username or password')
  })

  describe('account creation', () => {
    beforeEach(() => cy.contains('[role="tab"]', 'Create account').click())

    it('rejects mismatched passwords', () => {
      const { username, password } = newCredentials()
      field('Username').type(username)
      field('Password').type(password, { log: false })
      field('Confirm password').type(`${password}x`, { log: false })
      cy.get('button.auth-submit').click()
      cy.get('[role="alert"]').should('contain', 'Passwords do not match.')
    })

    it('requires the data policy to be accepted', () => {
      const { username, password } = newCredentials()
      field('Username').type(username)
      field('Password').type(password, { log: false })
      field('Confirm password').type(password, { log: false })
      cy.get('button.auth-submit').click()
      cy.get('[role="alert"]').should('contain', 'Accept the data policy to create an account.')
    })

    it('opens and closes the data policy', () => {
      cy.contains('button', 'data policy').click()
      cy.get('[role="dialog"]').should('be.visible')
      cy.get('[aria-label="Close policy"]').click()
      cy.get('[role="dialog"]').should('not.exist')
    })

    it('shows the three plans with their assigned model', () => {
      cy.get('.plan-option').should('have.length', 3)
      cy.get('.plan-option.selected').should('contain', 'standard')
      cy.get('.plan-option').each(($plan) => {
        expect($plan.find('small').text()).not.to.equal('Model unavailable')
        expect($plan.find('small').text()).not.to.equal('')
      })
      cy.contains('.plan-option', 'premium').click().should('have.class', 'selected')
      cy.contains('.plan-option', 'standard').should('not.have.class', 'selected')
    })

    it('creates an account and lands in the app', () => {
      const credentials = newCredentials()
      field('Username').type(credentials.username)
      field('Password').type(credentials.password, { log: false })
      field('Confirm password').type(credentials.password, { log: false })
      cy.contains('.plan-option', 'premium').click()
      cy.get('.check-row input[type="checkbox"]').check()
      cy.get('button.auth-submit').click()
      cy.get('.user-chip').should('contain', credentials.username).and('contain', 'premium | user')
      cy.get('nav[aria-label="Main navigation"]').contains('AI Chat').should('be.visible')
      cy.deleteUser(credentials)
    })
  })
})
