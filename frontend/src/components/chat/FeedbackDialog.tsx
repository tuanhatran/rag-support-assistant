import { useState, type FormEvent } from 'react'
import { Shield, Star, X } from 'lucide-react'

const feedbackOptions = [
  ['incorrect', 'Incorrect'],
  ['incomplete', 'Incomplete'],
  ['irrelevant_sources', 'Sources missed the mark'],
  ['unclear', 'Hard to follow'],
  ['too_slow', 'Too slow'],
  ['other', 'Other'],
]

interface FeedbackDialogProps {
  retentionDays: number
  onClose: () => void
  onOpenPolicy: () => void
  onSubmit: (categories: string[], comment: string) => void
}

export function FeedbackDialog({ retentionDays, onClose, onOpenPolicy, onSubmit }: FeedbackDialogProps) {
  const [categories, setCategories] = useState<string[]>([])
  const [comment, setComment] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit(categories, comment)
  }

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        className="modal feedback-modal"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">ANSWER FEEDBACK</span>
            <h2 id="feedback-title">What could be better?</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close feedback" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="feedback-options">
          {feedbackOptions.map(([value, label]) => (
            <label className="check-row" key={value}>
              <input
                type="checkbox"
                checked={categories.includes(value)}
                onChange={(event) =>
                  setCategories((current) =>
                    event.target.checked ? [...current, value] : current.filter((item) => item !== value),
                  )
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="field-label">
          Additional context
          <textarea
            className="text-area"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={2000}
            placeholder="Share a detail that would help improve this answer..."
            rows={4}
          />
        </label>
        <p className="data-notice">
          <Shield size={13} />
          Comments are redacted and retained for {retentionDays} days.{' '}
          <button type="button" className="text-link" onClick={onOpenPolicy}>
            Data policy
          </button>
        </p>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary">
            <Star size={15} />
            Submit feedback
          </button>
        </div>
      </form>
    </div>
  )
}
