// A person marked as editing a field of a node (design 5, plan 7 D14).
export interface PresenceRow { id: string; userId: string; userName: string; nodeId: string; field: string }
export interface PresenceEvent { action: 'create' | 'update' | 'delete'; record: PresenceRow }
