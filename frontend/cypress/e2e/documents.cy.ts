import type { Credentials } from '../support/helpers'

describe('Documents screen', () => {
  let credentials: Credentials

  beforeEach(() => {
    cy.registerUser('basic').then(created => { credentials = created })
    cy.visit('/')
    cy.get('nav[aria-label="Main navigation"]').contains('button', 'Documents').click()
    cy.get('.document-row').should('have.length', 10)
  })

  afterEach(() => cy.deleteUser(credentials))

  it('lists all runbooks with their tag chips', () => {
    cy.get('.document-count').should('contain', '10')
    cy.contains('.document-row', 'VPN Connection Issues').find('.tag-chip').should('contain', 'vpn')
  })

  it('filters by search text', () => {
    cy.get('input[aria-label="Search documents"]').type('printer')
    cy.get('.document-row').should('have.length.at.least', 1)
    cy.get('.document-row').should('contain', 'Printer Not Responding').and('not.contain', 'VPN Connection Issues')
    cy.get('[aria-label="Clear search"]').click()
    cy.get('.document-row').should('have.length', 10)
  })

  it('shows an empty state when nothing matches', () => {
    cy.get('input[aria-label="Search documents"]').type('zzzzqqqq')
    cy.get('.empty-documents').should('contain', 'No documents match')
  })

  it('filters by category', () => {
    cy.get('select[aria-label="Filter by category"]').select('Network')
    cy.get('.document-row').should('have.length', 2)
    cy.get('.document-row').should('contain', 'VPN Connection Issues').and('contain', 'Wi-Fi Connectivity Problems')
  })

  it('filters by tag', () => {
    cy.contains('.document-row', 'Database Connection Timeouts').find('.tag-chip').contains('mongodb').click()
    cy.get('.document-row').should('contain', 'Database Connection Timeouts')
    cy.get('.document-row').should('not.contain', 'Printer Not Responding')
    cy.get('.tag-selected').should('exist')
  })

  it('opens and closes a rendered runbook', () => {
    cy.get('.reader-empty').should('contain', 'Choose a document')
    cy.contains('.document-open', 'VPN Connection Issues').click()
    cy.get('.document-reader h2').should('contain', 'VPN Connection Issues')
    cy.get('.reader-tags').should('contain', 'vpn')
    cy.get('.reader-content').should('not.be.empty')
    cy.get('[aria-label="Close document"]').click()
    cy.get('.reader-empty').should('contain', 'Choose a document')
  })
})
