export const COUNTRIES_RPC_ID = 'DqDTgb';
export const ALLOWED_HOURS = [4, 24, 48, 168] as const;
export const ALLOWED_SORTS = ['relevance', 'volume', 'recency', 'title'] as const;
export const ALLOWED_STATUSES = ['all', 'active', 'ended'] as const;
export const DEFAULTS = {
  geo: 'SG',
  hl: 'en',
  hours: 24,
  limit: 25,
  category: 0,
  sort: 'relevance',
  status: 'all',
} as const;
