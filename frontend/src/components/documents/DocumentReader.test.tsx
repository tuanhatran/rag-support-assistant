import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DocumentReader } from './DocumentReader'
import { componentFixtures } from '../../test/fixtures'

const user = userEvent.setup

describe('DocumentReader', () => {
  it('renders empty and selected document reader states', async () => {
    const onClose = vi.fn()
    const document = componentFixtures.document
    const { rerender } = render(<DocumentReader document={null} onClose={onClose} />)
    expect(screen.getByText('Choose a document')).toBeInTheDocument()
    rerender(<DocumentReader document={document} onClose={onClose} />)
    expect(screen.getByText(document.title)).toBeInTheDocument()
    expect(screen.getByText('vpn')).toBeInTheDocument()
    rerender(<DocumentReader document={{ ...document, markdown: undefined }} onClose={onClose} />)
    expect(screen.getByText(document.title)).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
