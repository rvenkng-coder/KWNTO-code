export interface AuthUser {
  id: string
  email: string
  name: string
  verified: boolean
}
/** What a project card shows: how much is in it and where the nodes of its first chapter sit. */
export interface ProjectPreview {
  chapterCount: number
  nodeCount: number
  nodes: { x: number; y: number; width: number; height: number }[]
}
export interface Team {
  id: string
  name: string
  isOwner: boolean
}
export interface TeamMember {
  id: string
  userId: string
  name: string
  role: 'owner' | 'member'
}
export interface TeamSettings {
  joinCode: string
  joinCodeEnabled: boolean
}
export interface Invite {
  id: string
  teamName: string
  invitedByName: string
}
export interface Preferences {
  theme: 'light' | 'dark'
  minimapVisible: boolean
  cardFontSize: number
  cardMediaSize: number
}
