import { useState } from 'react'
import { MAX_COMMENT_LENGTH } from '../../backend'
import { useSession } from '../auth/useSession'
import { canDelete, commentLength, commentsOf } from './commentList'
import { CommentRow } from './CommentRow'
import { useCommentStore } from './useNodeComments'
import { useOnline } from './useOnline'

export const OFFLINE_COMMENTS = 'Comments need a connection.'

/** A node's comments, oldest first, and a box to add one. Used in the editor's panel and the comment viewer. */
export function CommentsSection({ nodeId }: { nodeId: string }) {
  const { user } = useSession()
  const all = useCommentStore((s) => s.comments)
  const isOwner = useCommentStore((s) => s.isOwner)
  const error = useCommentStore((s) => s.error)
  const [text, setText] = useState('')
  const online = useOnline()
  const list = commentsOf(all, nodeId)
  const length = commentLength(text)
  const tooLong = length > MAX_COMMENT_LENGTH
  const disabled = !online || text.trim() === '' || tooLong

  async function submit() {
    if (await useCommentStore.getState().add(nodeId, text)) setText('')
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Comments">
      <h4 className="font-semibold">Comments</h4>
      <ul className="flex flex-col gap-2">
        {list.map((c) => (
          <CommentRow key={c.id} comment={c} deletable={user !== null && canDelete(c, user.id, isOwner)} onDelete={(id) => useCommentStore.getState().remove(id)} />
        ))}
      </ul>
      <label className="flex flex-col gap-1 text-sm">Add a comment
        <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={disabled} onClick={() => void submit()}>Comment</button>
        <span className={`text-xs ${tooLong ? 'text-accent' : 'text-muted'}`}>{length}/{MAX_COMMENT_LENGTH}</span>
        {!online && <span className="text-xs">{OFFLINE_COMMENTS}</span>}
      </div>
      {error !== null && <p role="alert" className="text-sm">{error}</p>}
    </section>
  )
}
