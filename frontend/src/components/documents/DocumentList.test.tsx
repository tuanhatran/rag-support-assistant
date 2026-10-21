import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DocumentList } from './DocumentList'
import { componentFixtures } from '../../test/fixtures'

const user = userEvent.setup

describe('DocumentList', () => {
  it('filters document list controls, opens rows, toggles tags, and renders empty/error states', async () => {
    const onQueryChange = vi.fn()
    const onCategoryChange = vi.fn()
    const onTagChange = vi.fn()
    const onOpen = vi.fn()
    const document = componentFixtures.document
    const props = {
      documents: [document],
      selectedId: document.id,
      query: 'vpn',
      category: 'Network',
      tag: 'vpn',
      categories: ['All categories', 'Network'],
      error: '',
      onQueryChange,
      onCategoryChange,
      onTagChange,
      onOpen,
    }
    const { rerender } = render(<DocumentList {...props} />)
    await user().click(screen.getByRole('button', { name: 'Clear search' }))
    await user().selectOptions(screen.getByRole('combobox', { name: 'Filter by category' }), 'All categories')
    await user().click(screen.getByRole('button', { name: /VPN troubleshooting/ }))
    await user().click(screen.getByRole('button', { name: 'vpn' }))
    expect(onQueryChange).toHaveBeenCalledWith('')
    expect(onCategoryChange).toHaveBeenCalledWith('All categories')
    expect(onOpen).toHaveBeenCalledWith(document.id)
    expect(onTagChange).toHaveBeenCalledWith('')
    rerender(<DocumentList {...props} documents={[]} query="" tag="" error="Could not load" />)
    expect(screen.getByText('Could not load')).toBeInTheDocument()
    expect(screen.queryByText('No documents match')).not.toBeInTheDocument()
    rerender(<DocumentList {...props} documents={[]} query="" tag="" error="" />)
    expect(screen.getByText('No documents match')).toBeInTheDocument()
  })
})
