// A comment on a node (design 5, plan 7 D13). `authorId` is null when the author's account is gone.
export interface Comment {
  id: string
  projectId: string
  nodeId: string
  authorId: string | null
  authorName: string
  body: string
  created: string
}
export interface CommentEvent {
  action: 'create' | 'delete'
  record: Comment
}
export const MAX_COMMENT_LENGTH = 2000
