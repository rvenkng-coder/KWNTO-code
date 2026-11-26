import { useState } from 'react'
import type { Comment } from '../../backend'

export const DELETE_QUESTION = 'Delete this comment?'

interface CommentRowProps {
  comment: Comment
  deletable: boolean
  onDelete: (id: string) => Promise<void>
}

/** One comment as plain text (security.md 5): `pre-wrap` keeps its line breaks, nothing is parsed as HTML. */
export function CommentRow({ comment, deletable, onDelete }: CommentRowProps) {
  const [asking, setAsking] = useState(false)
  return (
    <li data-testid="comment-row" className="flex flex-col gap-1 rounded-base border border-border p-2">
      <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted">
        <strong className="text-text">{comment.authorName}</strong>
        <time dateTime={comment.created}>{new Date(comment.created).toLocaleString()}</time>
      </div>
      <p className="whitespace-pre-wrap break-words">{comment.body}</p>
      {deletable && !asking && (
        <button type="button" className="btn self-start text-xs" onClick={() => setAsking(true)}>
          Delete
        </button>
      )}
      {deletable && asking && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{DELETE_QUESTION}</span>
          <button
            type="button"
            className="btn"
            onClick={() => void onDelete(comment.id).finally(() => setAsking(false))}
          >
            Delete
          </button>
          <button type="button" className="btn" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      )}
    </li>
  )
}
