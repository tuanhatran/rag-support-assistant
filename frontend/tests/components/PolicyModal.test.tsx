import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as privacyApi from '../../src/api/privacy'
import { PolicyModal } from '../../src/components/PolicyModal'

describe('PolicyModal', () => {
  it('falls back when the policy cannot be loaded and keeps acceptance disabled', async () => {
    vi.spyOn(privacyApi, 'getPolicy').mockRejectedValueOnce(new Error('Policy offline'))
    render(<PolicyModal blocking onAccept={vi.fn()} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(await waitFor(() => screen.getByText('Loading the current policy...'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept policy' })).toBeDisabled()
  })
})
