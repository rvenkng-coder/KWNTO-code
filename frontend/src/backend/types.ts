export interface AuthUser { id: string; email: string; name: string; verified: boolean }
export interface Team { id: string; name: string; isOwner: boolean }
export interface TeamMember { id: string; userId: string; name: string; role: 'owner' | 'member' }
export interface TeamSettings { joinCode: string; joinCodeEnabled: boolean }
export interface Invite { id: string; teamName: string; invitedByName: string }
export interface Preferences { theme: 'light' | 'dark'; minimapVisible: boolean }
