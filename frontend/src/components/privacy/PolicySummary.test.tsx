import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PolicySummary } from './PolicySummary'
import { componentFixtures } from '../../test/fixtures'

const user = userEvent.setup

describe('PolicySummary', () => {
  it('renders policy sections and empty policy, and opens full policy', async () => {
    const onOpenFullPolicy = vi.fn()
    const { rerender } = render(<PolicySummary policy={null} onOpenFullPolicy={onOpenFullPolicy} />)
    expect(screen.getByRole('heading', { name: 'Data policy' })).toBeInTheDocument()
    rerender(<PolicySummary policy={componentFixtures.policy} onOpenFullPolicy={onOpenFullPolicy} />)
    expect(screen.getByText('Retention')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /Open full policy/ }))
    expect(onOpenFullPolicy).toHaveBeenCalledOnce()
  })
})
