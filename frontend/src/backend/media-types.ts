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
}

export interface StorageInfo {
  usedBytes: number
  quotaBytes: number
  maxBytes: Record<MediaKind, number>
  allowedTypes: string[]
}

export interface MediaEvent {
  action: 'create' | 'delete'
  record: Media
}
