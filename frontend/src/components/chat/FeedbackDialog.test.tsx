import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FeedbackDialog } from './FeedbackDialog'

const user = userEvent.setup

describe('FeedbackDialog', () => {
  it('selects and removes feedback categories, submits comment, and handles both close paths', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const onOpenPolicy = vi.fn()
    render(<FeedbackDialog retentionDays={30} onClose={onClose} onOpenPolicy={onOpenPolicy} onSubmit={onSubmit} />)
    const incorrect = screen.getByLabelText('Incorrect')
    await user().click(incorrect)
    await user().click(incorrect)
    await user().click(screen.getByLabelText('Hard to follow'))
    await user().type(screen.getByLabelText('Additional context'), 'Needs more detail')
    await user().click(screen.getByRole('button', { name: 'Data policy' }))
    await user().click(screen.getByRole('button', { name: 'Submit feedback' }))
    expect(onSubmit).toHaveBeenCalledWith(['unclear'], 'Needs more detail')
    expect(onOpenPolicy).toHaveBeenCalledOnce()
    await user().click(screen.getByRole('button', { name: 'Close feedback' }))
    fireEvent.mouseDown(screen.getByRole('presentation'), { target: screen.getByRole('presentation') })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
