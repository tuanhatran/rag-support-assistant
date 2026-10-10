import { ChevronDown } from 'lucide-react'
import type { Feedback, FeedbackStats } from './types'

type Props = { feedback: Feedback[]; stats: FeedbackStats; rating: string; onRatingChange: (rating: string) => void }

export function FeedbackSection({ feedback, stats, rating, onRatingChange }: Props) {
  return (
    <section className="admin-section">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">ANSWER QUALITY</span>
          <h2>Chat feedback</h2>
          <p>Review ratings and user comments on generated answers.</p>
        </div>
        <label className="select-wrap compact-select">
          <span>Rating</span>
          <select value={rating} onChange={(event) => onRatingChange(event.target.value)}>
            <option value="">All ratings</option>
            <option value="up">Helpful</option>
            <option value="down">Not helpful</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      <div className="stats-strip">
        {[
          ['TOTAL RATINGS', stats.total],
          ['HELPFUL', stats.helpful],
          ['NOT HELPFUL', stats.not_helpful],
          ['SATISFACTION', `${stats.satisfaction_percent}%`],
        ].map(([label, value]) => (
          <div className="stat-cell" key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
      <div className="feedback-cards">
        {feedback.map((item) => (
          <article className="feedback-card" key={`${item.session_id}-${item.message_id}`}>
            <div className="feedback-card-head">
              <span className={`rating-pill ${item.rating}`}>{item.rating === 'up' ? 'Helpful' : 'Not helpful'}</span>
              <span>{item.username}</span>
              <span>{new Date(item.created_at).toLocaleString()}</span>
              <span className="feedback-model">{item.model?.model}</span>
            </div>
            <div className="feedback-exchange">
              <b>Question</b>
              <p>{item.question}</p>
              <b>Answer</b>
              <p>{item.answer}</p>
            </div>
            {item.categories.length > 0 && (
              <div className="feedback-category-row">
                {item.categories.map((value) => (
                  <span className="feedback-category" key={value}>
                    {value.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
            {item.comment && <blockquote>{item.comment}</blockquote>}
          </article>
        ))}
        {feedback.length === 0 && <div className="table-empty">No feedback matches this filter.</div>}
      </div>
    </section>
  )
}
