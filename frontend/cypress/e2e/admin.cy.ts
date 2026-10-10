import { adminCredentials, requireAdmin } from '../support/helpers'
import type { Credentials } from '../support/helpers'

const connectionName = `e2e-conn-${Date.now().toString(36)}`
const openAdmin = () => cy.get('nav[aria-label="Main navigation"]').contains('button', 'Admin').click()
const openTab = (name: string) => cy.contains('[role="tab"]', name).click()

describe('Admin screen', () => {
  let user: Credentials

  before(function () {
    requireAdmin(this)
  })

  beforeEach(() => {
    // The user is created first because registration replaces the session cookie.
    cy.registerUser('standard').then((created) => {
      user = created
      cy.seedConversation('My VPN is stuck on Connecting').then(({ sessionId, messageId }) => {
        cy.request({
          method: 'POST',
          url: '/api/feedback',
          body: {
            session_id: sessionId,
            message_id: messageId,
            rating: 'down',
            categories: ['incorrect'],
            comment: 'e2e feedback comment',
          },
        })
          .its('status')
          .should('eq', 200)
      })
    })
    cy.adminLogin()
    cy.visit('/')
    openAdmin()
    cy.contains('h1', 'Admin console').should('be.visible')
  })

  afterEach(() => cy.deleteUser(user))

  after(() => {
    if (!adminCredentials()) return
    cy.adminLogin()
    cy.request('/api/admin/connections').then(({ body }) => {
      body
        .filter((item: { name: string; plans: string[] }) => item.name.startsWith('e2e-conn-') && !item.plans.length)
        .forEach((item: { id: string }) =>
          cy.request({ method: 'DELETE', url: `/api/admin/connections/${item.id}`, failOnStatusCode: false }),
        )
    })
  })

  it('shows the 5 admin tabs', () => {
    cy.get('[role="tab"]').then(($tabs) => {
      expect($tabs.toArray().map((tab) => tab.textContent)).to.deep.equal([
        'LLM connections',
        'Ingestion',
        'Users',
        'Chat feedback',
        'Audit log',
      ])
    })
    cy.contains('[role="tab"]', 'LLM connections').should('have.attr', 'aria-selected', 'true')
  })

  describe('LLM connections', () => {
    it('lists the seeded simulator with its plans and protects assigned connections', () => {
      cy.contains('tr', 'Built-in simulator').within(() => {
        cy.get('.plan-badge').should('have.length.at.least', 1)
        cy.get('button[title="Delete connection"]').should('be.disabled')
      })
    })

    it('creates, tests, edits and deletes a connection', () => {
      cy.contains('button', 'Add connection').click()
      cy.get('[role="dialog"]').within(() => {
        cy.contains('h2', 'Add connection')
        cy.contains('label', /^Name/).find('input').type(connectionName)
        cy.get('.plan-checks input[type="checkbox"]').uncheck()
        cy.contains('button', 'Save connection').click()
      })
      cy.get('.page-alert').should('contain', 'Connection created.')
      cy.contains('tr', connectionName).should('contain', 'No key')

      cy.get(`button[aria-label="Test ${connectionName}"]`).click()
      cy.get('.page-alert.inline-success').should('not.contain', 'Testing connection...')

      cy.get(`button[aria-label="Edit ${connectionName}"]`).click()
      cy.get('[role="dialog"]').within(() => {
        cy.contains('h2', 'Edit connection')
        cy.contains('label', /^Max tokens/)
          .find('input')
          .clear()
          .type('800')
        cy.contains('button', 'Save connection').click()
      })
      cy.get('.page-alert').should('contain', 'Connection updated.')

      cy.get(`button[aria-label="Delete ${connectionName}"]`).click()
      cy.get('.page-alert').should('contain', 'Connection deleted.')
      cy.contains('tr', connectionName).should('not.exist')
    })
  })

  describe('Users', () => {
    beforeEach(() => openTab('Users'))

    it('enters edit mode with no changes and hides Confirm when staged values return to saved values', () => {
      cy.intercept('PATCH', '/api/admin/users/*').as('updateUser')
      cy.contains('tr', user.username).as('userRow')
      cy.get('@userRow').find('button[aria-label^="Edit "]').click()
      cy.get('@userRow').find('select').should('have.length', 2)
      cy.get('@userRow').find('td').first().should('contain', user.username).find('input, select').should('not.exist')
      cy.get('@userRow').contains('button', 'Cancel').should('be.visible')
      cy.get('@userRow').contains('button', 'Confirm').should('not.exist')
      cy.get('@userRow').find('select').eq(0).select('admin')
      cy.get('@userRow').find('select').eq(1).select('premium')
      cy.get('@userRow').contains('button', 'Confirm').should('be.enabled')
      cy.get('@userRow').find('select').eq(0).select('user')
      cy.get('@userRow').find('select').eq(1).select('standard')
      cy.get('@userRow').contains('button', 'Confirm').should('not.exist')
      cy.get('@userRow').contains('button', 'Cancel').should('be.visible')
      cy.get('@userRow').find('td').first().should('contain', user.username)
      cy.get('@updateUser.all').should('have.length', 0)
    })

    it('cancels staged role and plan changes without saving them', () => {
      cy.intercept('PATCH', '/api/admin/users/*').as('updateUser')
      cy.contains('tr', user.username).as('userRow')
      cy.get('@userRow').find('button[aria-label^="Edit "]').click()
      cy.get('@userRow').find('select').eq(0).select('admin')
      cy.get('@userRow').find('select').eq(1).select('premium')
      cy.request('/api/admin/users')
        .its('body')
        .then((users: { username: string; plan: string }[]) => {
          expect(users.find((item) => item.username === user.username)?.plan).to.equal('standard')
        })
      cy.get('@userRow').contains('button', 'Cancel').click()
      cy.get('@userRow').find('select').should('not.exist')
      cy.get('@userRow').should('contain', 'user').and('contain', 'standard')
      cy.get('@updateUser.all').should('have.length', 0)
    })

    it('confirms and persists staged role and plan changes together', () => {
      cy.intercept('PATCH', '/api/admin/users/*').as('updateUser')
      cy.contains('tr', user.username).as('userRow')
      cy.get('@userRow').find('button[aria-label^="Edit "]').click()
      cy.get('@userRow').find('select').eq(0).select('admin')
      cy.get('@userRow').find('select').eq(1).select('premium')
      cy.get('@userRow').contains('button', 'Confirm').click()
      cy.wait('@updateUser').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(request.body).to.deep.equal({ role: 'admin', plan: 'premium' })
      })
      cy.get('.page-alert').should('contain', `Updated ${user.username}.`)
      cy.get('@userRow').find('select').should('not.exist')
      cy.get('@userRow').should('contain', 'admin').and('contain', 'premium')
    })

    it('locks row edits until a delayed user update finishes', () => {
      cy.intercept('PATCH', '/api/admin/users/*', (request) => {
        request.continue((response) => response.setDelay(1200))
      }).as('updateUser')
      cy.contains('tr', user.username).as('userRow')
      cy.get('@userRow').find('button[aria-label^="Edit "]').click()
      cy.get('@userRow').find('select').eq(0).select('admin')
      cy.get('@userRow').find('select').eq(1).select('premium')
      cy.get('@userRow').contains('button', 'Confirm').click()

      cy.get('@userRow').contains('button', 'Saving...').should('be.disabled').click({ force: true })
      cy.get('@userRow').contains('button', 'Cancel').should('be.disabled').click({ force: true })
      cy.get('@userRow').find('select').eq(1).should('be.disabled').select('basic', { force: true })
      cy.get('@userRow').find('select').eq(0).should('have.value', 'admin')
      cy.get('@userRow').find('select').eq(1).should('have.value', 'premium')
      cy.get('@updateUser.all').should('have.length', 1)

      cy.wait('@updateUser').then(({ request, response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(request.body).to.deep.equal({ role: 'admin', plan: 'premium' })
      })
      cy.get('@userRow').find('select').should('not.exist')
      cy.get('@userRow').should('contain', 'admin').and('contain', 'premium')
      cy.request('/api/admin/users').then(({ body }) => {
        const savedUser = (body as { username: string; role: string; plan: string }[]).find(
          (item) => item.username === user.username,
        )
        expect(savedUser).to.include({ role: 'admin', plan: 'premium' })
      })
      cy.get('@updateUser.all').should('have.length', 1)
    })

    it('keeps a rejected last-admin edit staged until cancelled', () => {
      cy.request('/api/admin/users').then(({ body }) => {
        const admins = body.filter((item: { role: string }) => item.role === 'admin')
        if (admins.length !== 1) {
          Cypress.log({ name: 'skip', message: 'More than one admin exists; demotion check skipped.' })
          return
        }
        const admin = admins[0] as { username: string; plan: string }
        const stagedPlan = admin.plan === 'basic' ? 'premium' : 'basic'
        cy.intercept('PATCH', '/api/admin/users/*').as('updateUser')
        cy.contains('tr', admin.username).as('adminRow')
        cy.get('@adminRow').find('button[aria-label^="Edit "]').click()
        cy.get('@adminRow').find('select').first().select('user')
        cy.get('@adminRow').find('select').eq(1).select(stagedPlan)
        cy.get('@adminRow').contains('button', 'Confirm').click()
        cy.wait('@updateUser').then(({ request, response }) => {
          expect(request.body).to.deep.equal({ role: 'user', plan: stagedPlan })
          expect(response?.statusCode).not.to.equal(200)
        })
        cy.get('.form-error.page-alert').should('contain', 'The last admin cannot be demoted')
        cy.get('@adminRow').find('select').first().should('have.value', 'user')
        cy.get('@adminRow').find('select').eq(1).should('have.value', stagedPlan)
        cy.get('@adminRow').contains('button', 'Confirm').should('be.visible')
        cy.get('@adminRow').contains('button', 'Cancel').click()
        cy.get('@adminRow').find('select').should('not.exist')
        cy.get('@adminRow').should('contain', 'admin').and('contain', admin.plan)
        cy.request('/api/admin/users').then(({ body: refreshedUsers }) => {
          expect(refreshedUsers.find((item: { username: string }) => item.username === admin.username)).to.include({
            role: 'admin',
            plan: admin.plan,
          })
        })
      })
    })
  })

  describe('Chat feedback', () => {
    beforeEach(() => openTab('Chat feedback'))

    it('shows the statistics and the submitted feedback', () => {
      cy.get('.stat-cell').should('have.length', 4)
      cy.get('.stats-strip').should('contain', 'TOTAL RATINGS').and('contain', 'SATISFACTION')
      cy.contains('.feedback-card', user.username)
        .should('contain', 'Not helpful')
        .and('contain', 'e2e feedback comment')
    })

    it('filters by rating', () => {
      cy.get('.compact-select select').select('Helpful')
      cy.get('.feedback-cards').should('not.contain', user.username)
      cy.get('.compact-select select').select('Not helpful')
      cy.contains('.feedback-card', user.username).should('be.visible')
    })
  })

  describe('Audit log', () => {
    beforeEach(() => openTab('Audit log'))

    it('lists events and applies filters', () => {
      cy.get('tbody tr').should('have.length.at.least', 1)
      cy.get('input[placeholder="e.g. auth.login"]').type('auth.register')
      cy.get('.audit-filters select').select('Success')
      cy.get('input[placeholder="Filter actor"]').type(user.username)
      cy.contains('button', 'Apply filters').click()
      cy.get('tbody tr').should('have.length', 1).and('contain', 'auth.register').and('contain', user.username)
    })

    it('shows an empty state when no event matches', () => {
      cy.get('input[placeholder="Filter actor"]').type('no-such-actor-e2e')
      cy.contains('button', 'Apply filters').click()
      cy.get('.table-empty').should('contain', 'No audit events match these filters.')
    })
  })
})
