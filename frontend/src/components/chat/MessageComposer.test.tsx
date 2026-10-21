import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MessageComposer } from './MessageComposer'

const user = userEvent.setup

describe('MessageComposer', () => {
  it('sends with Enter but preserves Shift+Enter and dismisses composer messages', async () => {
    const onSend = vi.fn()
    const onQuestionChange = vi.fn()
    const onDismissError = vi.fn()
    const onDismissNotice = vi.fn()
    const onOpenPolicy = vi.fn()
    const props = {
      question: '  help  ',
      sending: false,
      error: 'Failed',
      notice: 'Saved',
      retentionDays: 45,
      inputRef: createRef<HTMLTextAreaElement>(),
      onQuestionChange,
      onSend,
      onDismissError,
      onDismissNotice,
      onOpenPolicy,
    }
    render(<MessageComposer {...props} />)
    const input = screen.getByRole('textbox', { name: 'Your question' })
    expect(screen.getByRole('button', { name: 'Send question' })).toBeEnabled()
    expect(screen.getByText(/retained for 45 days/)).toBeInTheDocument()
    await user().click(screen.getAllByRole('button', { name: 'Dismiss' })[0])
    await user().click(screen.getAllByRole('button', { name: 'Dismiss' })[1])
    await user().click(screen.getByRole('button', { name: 'Data policy' }))
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledOnce()
    expect(onDismissError).toHaveBeenCalledOnce()
    expect(onDismissNotice).toHaveBeenCalledOnce()
    expect(onOpenPolicy).toHaveBeenCalledOnce()
    const form = input.closest('form')!
    fireEvent.submit(form)
    expect(onSend).toHaveBeenCalledTimes(2)
  })
})
