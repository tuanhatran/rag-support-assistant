import type { FormEvent, KeyboardEvent, RefObject } from 'react'
import { Send, Shield, X } from 'lucide-react'

interface MessageComposerProps {
  question: string
  sending: boolean
  error: string
  notice: string
  retentionDays: number
  inputRef: RefObject<HTMLTextAreaElement | null>
  onQuestionChange: (question: string) => void
  onSend: () => void
  onDismissError: () => void
  onDismissNotice: () => void
  onOpenPolicy: () => void
}

export function MessageComposer({ question, sending, error, notice, retentionDays, inputRef, onQuestionChange, onSend, onDismissError, onDismissNotice, onOpenPolicy }: MessageComposerProps) {
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSend()
  }

  return <div className="composer-wrap">
    {error && <div className="inline-error" role="alert">{error}<button className="icon-button" aria-label="Dismiss" onClick={onDismissError}><X size={14} /></button></div>}
    {notice && <div className="inline-success">{notice}<button className="icon-button" aria-label="Dismiss" onClick={onDismissNotice}><X size={14} /></button></div>}
    <form className="composer" onSubmit={submit}><textarea ref={inputRef} value={question} onChange={event => onQuestionChange(event.target.value)} onKeyDown={keyDown} placeholder="Describe what you are trying to fix..." rows={2} maxLength={10000} aria-label="Your question" /><button className="send-button" disabled={!question.trim() || sending} aria-label="Send question" title="Send question"><Send size={17} /></button></form>
    <div className="composer-foot"><span><Shield size={12} />Questions are redacted and retained for {retentionDays} days.</span><button className="text-link" onClick={onOpenPolicy}>Data policy</button><span><kbd>Enter</kbd> to send <i /> <kbd>Shift + Enter</kbd> for a new line</span></div>
  </div>
}