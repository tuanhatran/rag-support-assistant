import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionDialog } from '../../../src/components/admin/ConnectionDialog'
import { blankConnection } from '../../../src/components/admin/types'
import { componentFixtures } from '../../support/fixtures'

const user = userEvent.setup

describe('ConnectionDialog', () => {
  it('covers provider-specific connection fields and plan selection', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    const onSubmit = vi.fn((event) => event.preventDefault())
    const connection = componentFixtures.connection
    const { rerender } = render(
      <ConnectionDialog
        form={blankConnection}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText(/built-in extractive simulator/)).toBeInTheDocument()
    await user().selectOptions(screen.getByLabelText('Provider'), 'openai')
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'openai' }}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText(/OpenAI, Mistral/)).toBeInTheDocument()
    expect(screen.getByLabelText('Base URL')).toHaveAttribute('placeholder', 'Leave empty for OpenAI')
    await user().selectOptions(screen.getByLabelText('Provider'), 'azure_openai')
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'azure_openai' }}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByLabelText('API version')).toHaveAttribute('placeholder', '2024-10-21')
    expect(screen.getByText(/deployment name/)).toBeInTheDocument()
    await user().selectOptions(screen.getByLabelText('Provider'), 'anthropic')
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'anthropic' }}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByLabelText('API version')).toHaveAttribute('placeholder', '2023-06-01')
    expect(screen.getByText(/Anthropic Messages API/)).toBeInTheDocument()
    await user().click(screen.getByLabelText('Basic'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ plans: expect.not.arrayContaining(['basic']) }))
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'openai', api_key: '', plans: ['standard'] }}
        editing={connection.id}
        connections={[connection]}
        busy
        error="Save failed"
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Edit connection' })).toBeInTheDocument()
    expect(screen.getByLabelText('API key')).toHaveAttribute('placeholder', 'Leave empty to keep sk-...1234')
    await user().click(screen.getByLabelText('Remove the stored API key'))
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'new-secret' } })
    await user().click(screen.getByRole('button', { name: 'Close form' }))
    expect(screen.getByText('Save failed')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ provider: 'openai' })
    expect(onChange).toHaveBeenCalledWith({ api_key: 'new-secret', remove_api_key: false })
  })

  it('updates connection fields and classifies local Ollama URLs', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    const onSubmit = vi.fn((event) => event.preventDefault())
    const props = { editing: null, connections: [], busy: false, error: '', onChange, onClose, onSubmit }
    const { rerender } = render(<ConnectionDialog {...props} form={{ ...blankConnection, provider: 'openai' }} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Local route' } })
    fireEvent.change(screen.getByLabelText('Model or deployment'), { target: { value: 'llama' } })
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'http://localhost:11434/v1' } })
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '0.7' } })
    fireEvent.change(screen.getByLabelText('Max tokens'), { target: { value: '2048' } })
    expect(onChange).toHaveBeenCalledWith({ name: 'Local route' })
    expect(onChange).toHaveBeenCalledWith({ model: 'llama' })
    expect(onChange).toHaveBeenCalledWith({ base_url: 'http://localhost:11434/v1' })
    expect(onChange).toHaveBeenCalledWith({ temperature: 0.7 })
    expect(onChange).toHaveBeenCalledWith({ max_tokens: 2048 })

    const localCases: [string, boolean][] = [
      ['http://localhost:11434/v1', true],
      ['http://127.0.0.1:11434/v1/', true],
      ['http://[::1]:11434/v1', true],
      ['https://localhost:11434/v1', false],
      ['http://remote-host:11434/v1', false],
      ['http://localhost:9999/v1', false],
      ['http://localhost:11434/api', false],
      ['http://user:pass@localhost:11434/v1', false],
      ['http://:pass@localhost:11434/v1', false],
      ['http://localhost:11434/v1?debug=1', false],
      ['http://localhost:11434/v1#section', false],
      ['not a valid url', false],
    ]
    for (const [baseUrl, isLocal] of localCases) {
      rerender(<ConnectionDialog {...props} form={{ ...blankConnection, provider: 'openai', base_url: baseUrl }} />)
      if (isLocal) expect(screen.getByLabelText('Local LLM')).toBeChecked()
      else expect(screen.getByLabelText('Local LLM')).not.toBeChecked()
      if (isLocal) expect(screen.getByLabelText('API key')).not.toBeRequired()
      else expect(screen.getByLabelText('API key')).toBeRequired()
    }

    rerender(
      <ConnectionDialog
        {...props}
        form={{ ...blankConnection, provider: 'openai', base_url: 'https://example.com/v1' }}
      />,
    )
    await user().click(screen.getByLabelText('Local LLM'))
    expect(onChange).toHaveBeenCalledWith({ base_url: 'http://localhost:11434/v1' })
    rerender(
      <ConnectionDialog
        {...props}
        form={{ ...blankConnection, provider: 'openai', base_url: 'http://localhost:11434/v1' }}
      />,
    )
    await user().click(screen.getByLabelText('Local LLM'))
    expect(onChange).toHaveBeenCalledWith({ base_url: '' })

    rerender(<ConnectionDialog {...props} form={{ ...blankConnection, provider: 'azure_openai' }} />)
    fireEvent.change(screen.getByLabelText('API version'), { target: { value: '2024-10-21' } })
    expect(onChange).toHaveBeenCalledWith({ api_version: '2024-10-21' })
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'mock' } })
    expect(onChange).toHaveBeenCalledWith({ provider: 'mock', model: 'extractive-simulator' })
  })
})
