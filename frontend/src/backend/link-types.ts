// A link on a node: a title and a web address (plan 2026-11-21-node-links).
export interface NodeLink {
  id: string
  projectId: string
  nodeId: string
  creatorId: string
  title: string
  url: string
  created: string
}

export interface LinkEvent {
  action: 'create' | 'delete'
  record: NodeLink
}
