export type MediaKind = 'audio' | 'video' | 'image'

export interface Media {
  id: string
  projectId: string
  nodeId: string
  uploaderId: string
  title: string
  kind: MediaKind
  sizeBytes: number
  fileName: string
  created: string
  // When a member removed it (hidden, still in the lead's storage); '' when it is in use.
  removedAt: string
}

export interface StorageInfo {
  usedBytes: number
  quotaBytes: number
  maxBytes: Record<MediaKind, number>
  allowedTypes: string[]
  // True when the caller is the team lead, the only one who restores or deletes for good.
  isLead: boolean
}

export interface MediaEvent {
  action: 'create' | 'update' | 'delete'
  record: Media
}
