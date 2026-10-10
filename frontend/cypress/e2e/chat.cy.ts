import type { Credentials } from '../support/helpers'

const suggestion = 'My VPN is stuck on Connecting, what should I do?'
const composer = () => cy.get('textarea[aria-label="Your question"]')

describe('AI Chat screen', () => {
  let credentials: Credentials

  beforeEach(() => {
    cy.registerUser('standard').then((created) => {
      credentials = created
    })
    cy.visit('/')
  })

  afterEach(() => cy.deleteUser(credentials))

  it('shows the empty state with five suggestions and the data notice', () => {
    cy.contains('h2', 'Start with a question.').should('be.visible')
    cy.get('.suggestion').should('have.length', 5)
    cy.get('.rail-empty').should('contain', 'Your recent conversations will appear here.')
    cy.get('.composer-foot').should('contain', 'retained for')
    cy.contains('.composer-foot button', 'Data policy').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('[aria-label="Close policy"]').click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('sends a question with Enter and shows a sourced answer', () => {
    composer().type(`${suggestion}{enter}`)
    cy.get('.exchange', { timeout: 20000 }).should('have.length', 1)
    cy.get('.question-bubble').should('contain', suggestion)
    cy.get('.answer-meta').should('contain', 'FIELDNOTE').and('contain', ' ms')
    cy.get('.source-chip').first().should('contain', '[1]')
    cy.get('.thread-row.current').should('contain', suggestion.slice(0, 40))
    composer().should('have.value', '')
  })

  it('starts a conversation from a suggestion', () => {
    cy.get('.suggestion').first().click()
    cy.get('.exchange', { timeout: 20000 }).should('have.length', 1)
    cy.get('.question-bubble').should('contain', suggestion)
  })

  it('opens a cited source document', () => {
    cy.get('.suggestion').first().click()
    cy.get('.source-chip', { timeout: 20000 }).first().click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('.document-modal-body').should('not.be.empty')
    cy.get('[aria-label="Close document"]').click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('flags redacted sensitive data', () => {
    composer().type('My VPN login fails, password=hunter2{enter}')
    cy.get('.redaction-flag', { timeout: 20000 }).should('contain', 'Sensitive data was redacted')
  })

  it('records a helpful rating', () => {
    cy.intercept('POST', '/api/feedback').as('feedback')
    cy.get('.suggestion').first().click()
    cy.get('button[title="Helpful"]', { timeout: 20000 }).click()
    cy.wait('@feedback').its('response.statusCode').should('eq', 200)
    cy.get('.inline-success').should('contain', 'Thanks for rating this answer.')
  })

  it('collects detailed feedback for a not helpful answer', () => {
    cy.intercept('POST', '/api/feedback').as('feedback')
    cy.get('.suggestion').first().click()
    cy.get('button[title="Not helpful"]', { timeout: 20000 }).click()
    cy.get('[role="dialog"]').should('contain', 'What could be better?')
    cy.get('.data-notice').should('contain', 'retained for')
    cy.contains('.feedback-options label', 'Incorrect').find('input').check()
    cy.contains('.feedback-options label', 'Too slow').find('input').check()
    cy.get('textarea.text-area').type('The steps did not match my client.')
    cy.contains('[role="dialog"] button', 'Submit feedback').click()
    cy.wait('@feedback')
      .its('request.body')
      .should((body) => {
        expect(body.rating).to.equal('down')
        expect(body.categories).to.have.members(['incorrect', 'too_slow'])
      })
    cy.get('[role="dialog"]').should('not.exist')
    cy.get('.inline-success').should('contain', 'Your feedback has been recorded.')
  })

  it('cancels the feedback form without saving', () => {
    cy.get('.suggestion').first().click()
    cy.get('button[title="Not helpful"]', { timeout: 20000 }).click()
    cy.contains('[role="dialog"] button', 'Cancel').click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('creates and deletes conversations', () => {
    cy.get('.suggestion').first().click()
    cy.get('.exchange', { timeout: 20000 }).should('have.length', 1)
    cy.get('.thread-row').should('have.length', 1)
    cy.get('button.new-thread').click()
    cy.contains('h2', 'Start with a question.').should('be.visible')
    cy.get('.thread-row').should('have.length', 2)
    cy.get('.thread-delete').first().click()
    cy.get('.thread-row').should('have.length', 1)
    cy.get('.thread-delete').first().click()
    cy.get('.thread-row').should('not.exist')
    cy.get('.rail-empty').should('contain', 'Your recent conversations will appear here.')
  })
})
