import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IngestionForm } from './IngestionForm'
import { componentFixtures } from '../../test/fixtures'

const user = userEvent.setup

describe('IngestionForm', () => {
  it('validates upload selection, drag state, options, and submits file settings', async () => {
    const onError = vi.fn()
    const onSelectionChange = vi.fn()
    const onSubmit = vi.fn()
    const { container, rerender } = render(
      <IngestionForm
        options={null}
        submitting={false}
        error=""
        onError={onError}
        onSelectionChange={onSelectionChange}
        onSubmit={onSubmit}
      />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['bad'], 'image.png', { type: 'image/png' })] } })
    expect(onError).toHaveBeenCalledWith('Unsupported file type. Only .txt and .pdf files are accepted.')
    rerender(
      <IngestionForm
        options={componentFixtures.options}
        submitting={false}
        error="Visible error"
        onError={onError}
        onSelectionChange={onSelectionChange}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText('Visible error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss error' })).toBeInTheDocument()
    const zeroFile = new File([], 'empty.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [zeroFile] } })
    expect(onError).toHaveBeenCalledWith('Uploaded file cannot be empty.')
    const largeFile = new File([new Uint8Array(512_001)], 'large.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [largeFile] } })
    expect(onError).toHaveBeenCalledWith('File exceeds maximum allowed size of 500 KB (512,000 bytes).')
    const validFile = new File(['runbook'], 'guide.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [validFile] } })
    expect(screen.getByText('guide.txt')).toBeInTheDocument()
    expect(screen.getByText('Cloudflare')).toBeInTheDocument()
    await user().clear(screen.getAllByRole('spinbutton')[0])
    await user().type(screen.getAllByRole('spinbutton')[0], '700')
    await user().selectOptions(screen.getAllByRole('combobox')[0], '\n')
    await user().selectOptions(screen.getAllByRole('combobox')[1], 'model-a')
    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    expect(onSubmit).toHaveBeenCalledWith(
      validFile,
      expect.objectContaining({ chunkSize: 700, embeddingModel: 'model-a' }),
    )
    expect(onSelectionChange).toHaveBeenCalled()
    const dropzone = container.querySelector('.upload-dropzone')!
    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveClass('dragging')
    fireEvent.dragLeave(dropzone)
    fireEvent.drop(dropzone, { dataTransfer: { files: [validFile] } })
    expect(dropzone).not.toHaveClass('dragging')
  })
})
