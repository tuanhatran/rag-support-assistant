export type Plan = 'basic' | 'standard' | 'premium'

export interface Credentials {
  username: string
  password: string
}

let counter = 0

function token() {
  counter += 1
  return `${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`
}

export function newCredentials(): Credentials {
  return { username: `e2e_${token()}`, password: `Pw-${token()}-${token()}` }
}

export function adminCredentials(): Credentials | null {
  const username = Cypress.env('ADMIN_USERNAME')
  const password = Cypress.env('ADMIN_PASSWORD')
  return username && password ? { username, password } : null
}

export function requireAdmin(context: Mocha.Context) {
  if (adminCredentials()) return
  Cypress.log({ name: 'skip', message: 'Set CYPRESS_ADMIN_USERNAME and CYPRESS_ADMIN_PASSWORD to run admin specs.' })
  context.skip()
}
