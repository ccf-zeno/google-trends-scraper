export const TRENDING_RPC_ID = 'i0OFE';
export const COUNTRIES_RPC_ID = 'DqDTgb';
export const ALLOWED_HOURS = [4, 24, 48, 168] as const;
export const ALLOWED_SORTS = ['relevance', 'volume', 'recency', 'title'] as const;
export const ALLOWED_STATUSES = ['all', 'active', 'ended'] as const;
export const SORT_KEYS = { relevance: 1, volume: 2, recency: 3, title: 4 } as const;
export const DEFAULTS = {
  geo: 'SG',
  hl: 'en',
  hours: 24,
  limit: 25,
  category: 0,
  sort: 'relevance',
  status: 'all',
} as const;
