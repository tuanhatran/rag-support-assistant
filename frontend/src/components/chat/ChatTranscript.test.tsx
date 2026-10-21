import { createRef } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatTranscript } from './ChatTranscript'
import { componentFixtures } from '../../test/fixtures'

const user = userEvent.setup

describe('ChatTranscript', () => {
  it('renders suggestions and complete answer states with citations and ratings', async () => {
    const onSendSuggestion = vi.fn()
    const onBrowse = vi.fn()
    const onOpenSource = vi.fn()
    const onRate = vi.fn()
    const endRef = createRef<HTMLDivElement>()
    const { rerender } = render(
      <ChatTranscript
        active={null}
        sending
        streamingAnswer={null}
        endRef={endRef}
        onSendSuggestion={onSendSuggestion}
        onBrowseDocuments={onBrowse}
        onOpenSource={onOpenSource}
        onRate={onRate}
      />,
    )
    expect(screen.getByText('Searching runbooks and preparing an answer')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /My VPN is stuck/ }))
    await user().click(screen.getByRole('button', { name: /Explore all support documents/ }))
    expect(onSendSuggestion).toHaveBeenCalledOnce()
    expect(onBrowse).toHaveBeenCalledOnce()
    rerender(
      <ChatTranscript
        active={{
          id: 's',
          title: 'Help',
          created_at: '',
          updated_at: '',
          messages: [
            componentFixtures.message,
            { ...componentFixtures.message, id: 'm2', status: 'error', redacted: false, sources: [] },
          ],
        }}
        sending={false}
        streamingAnswer={null}
        endRef={endRef}
        onSendSuggestion={onSendSuggestion}
        onBrowseDocuments={onBrowse}
        onOpenSource={onOpenSource}
        onRate={onRate}
      />,
    )
    expect(screen.getByText('Sensitive data was redacted before processing')).toBeInTheDocument()
    expect(screen.getByText('The configured model could not complete this answer.')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /VPN troubleshooting/ }))
    const firstAnswer = screen.getAllByRole('article')[0]
    await user().click(within(firstAnswer).getByRole('button', { name: 'Helpful' }))
    await user().click(within(firstAnswer).getByRole('button', { name: 'Not helpful' }))
    expect(onOpenSource).toHaveBeenCalledWith(componentFixtures.message.sources[0])
    expect(onRate).toHaveBeenNthCalledWith(1, componentFixtures.message, 'up')
    expect(onRate).toHaveBeenNthCalledWith(2, componentFixtures.message, 'down')
  })
})
