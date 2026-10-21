import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SourceDialog } from '../../../src/components/chat/SourceDialog'
import { componentFixtures } from '../../support/fixtures'

const user = userEvent.setup

describe('SourceDialog', () => {
  it('closes source dialog from close control or backdrop', async () => {
    const onClose = vi.fn()
    const document = componentFixtures.document
    const { container, rerender } = render(<SourceDialog source={document} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: document.title })).toBeInTheDocument()
    expect(
      screen.getByText((_text, element) => element?.tagName === 'P' && element.textContent === 'Restart the client.'),
    ).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    fireEvent.mouseDown(container.querySelector('.modal-scrim')!, { target: container.querySelector('.modal-scrim') })
    expect(onClose).toHaveBeenCalledTimes(2)
    rerender(<SourceDialog source={{ ...document, markdown: undefined }} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: document.title })).toBeInTheDocument()
  })
})
