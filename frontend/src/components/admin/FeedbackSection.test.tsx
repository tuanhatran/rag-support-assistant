import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Feedback as AdminFeedback, FeedbackStats } from '../../types/admin'
import { FeedbackSection } from './FeedbackSection'

const user = userEvent.setup

describe('FeedbackSection', () => {
  it('renders feedback statistics, comments, categories, filters, and empty state', async () => {
    const stats: FeedbackStats = { total: 2, helpful: 1, not_helpful: 1, satisfaction_percent: 50 }
    const entry: AdminFeedback = {
      session_id: 's',
      message_id: 'm',
      username: 'ava',
      rating: 'down',
      categories: ['irrelevant_sources'],
      comment: 'Add a source',
      question: 'Question',
      answer: 'Answer',
      model: { model: 'assistant' },
      created_at: '2026-01-01',
    }
    const onRatingChange = vi.fn()
    const { rerender } = render(
      <FeedbackSection feedback={[entry]} stats={stats} rating="" onRatingChange={onRatingChange} />,
    )
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('irrelevant sources')).toBeInTheDocument()
    expect(screen.getByText('Add a source')).toBeInTheDocument()
    await user().selectOptions(screen.getByRole('combobox'), 'down')
    expect(onRatingChange).toHaveBeenCalledWith('down')
    rerender(<FeedbackSection feedback={[]} stats={stats} rating="down" onRatingChange={onRatingChange} />)
    expect(screen.getByText('No feedback matches this filter.')).toBeInTheDocument()
  })
})
