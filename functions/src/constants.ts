export const REGION = 'northamerica-northeast1'
export const API_KEY_SECRET = 'ASSISTANT_API_KEY'
export const ASSISTANT_NAME = 'assistant'

export const COLLECTIONS = ['gigs', 'tours', 'contracts', 'payments', 'people', 'presenters', 'tasks', 'venues', 'rehearsals', 'events', 'inquiries'] as const
export const SUBCOLLECTIONS = ['answers', 'expenses', 'replies'] as const

export const AUDIT = 'audit'
export const EVENTS = 'events'

export const READ_ACTIONS = ['get', 'list', 'query'] as const
export const WRITE_ACTIONS = ['set', 'update', 'delete', 'commit'] as const
export type WriteOp = 'set' | 'update' | 'delete'

export const QUERY_OPS = {
  '==': '==',
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  in: 'in',
  'array-contains': 'array-contains',
} as const

export const LIMITS = { changes: 200, reason: 500, query: 500, list: 2000 } as const

export const TIME_KEY = '$time'
export const DELETE_KEY = '$delete'

const group = (names: readonly string[]) => names.join('|')
export const DOC_PATH = new RegExp(`^(${group(COLLECTIONS)})/[^/]+(/(${group(SUBCOLLECTIONS)})/[^/]+)?$`)
export const COLLECTION_PATH = new RegExp(`^(${group(COLLECTIONS)})(/[^/]+/(${group(SUBCOLLECTIONS)}))?$`)
export const DAY = /^\d{4}-\d{2}-\d{2}$/
