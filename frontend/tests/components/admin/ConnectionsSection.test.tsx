import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '../../../src/types/connections'
import { ConnectionsSection } from '../../../src/components/admin/ConnectionsSection'
import { planLabels } from '../../../src/components/admin/types'
import { componentFixtures } from '../../support/fixtures'

const user = userEvent.setup

describe('ConnectionsSection', () => {
  it('renders connections, plan warnings, API key state, and actions', async () => {
    const onAdd = vi.fn()
    const onEdit = vi.fn()
    const onTest = vi.fn()
    const onDelete = vi.fn()
    const connection = componentFixtures.connection
    const simulator: Connection = {
      ...connection,
      id: 'sim',
      name: 'Simulator',
      provider: 'mock',
      has_api_key: false,
      plans: [],
    }
    render(
      <ConnectionsSection
        connections={[connection, simulator]}
        missingPlans={[{ id: 'basic', label: 'Basic' }]}
        onAdd={onAdd}
        onEdit={onEdit}
        onTest={onTest}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText(/Basic has no model assigned/)).toBeInTheDocument()
    expect(screen.getByText('sk-...1234')).toBeInTheDocument()
    expect(screen.getByText('No key')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Add connection' }))
    await user().click(screen.getByRole('button', { name: 'Test Standard model' }))
    await user().click(screen.getByRole('button', { name: 'Edit Standard model' }))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onTest).toHaveBeenCalledWith(connection)
    expect(onEdit).toHaveBeenCalledWith(connection)
    expect(screen.getByRole('button', { name: 'Delete Standard model' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete Simulator' })).toBeEnabled()
    await user().click(screen.getByRole('button', { name: 'Delete Simulator' }))
    expect(onDelete).toHaveBeenCalledWith(simulator)
    const { rerender } = render(
      <ConnectionsSection
        connections={[]}
        missingPlans={[]}
        onAdd={onAdd}
        onEdit={onEdit}
        onTest={onTest}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('No model connections configured.')).toBeInTheDocument()
    rerender(
      <ConnectionsSection
        connections={[connection]}
        missingPlans={planLabels}
        onAdd={onAdd}
        onEdit={onEdit}
        onTest={onTest}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText(/Basic, Standard, Premium have no model assigned/)).toBeInTheDocument()
  })
})
