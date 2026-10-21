import type { NormalizedTrendingOptions, TrendingItem } from './types';

export function filterTrendingItems(
  items: TrendingItem[],
  options: NormalizedTrendingOptions,
): TrendingItem[] {
  const filtered = items.filter(
    (item) =>
      (options.category === 0 || item.categoryIds.includes(options.category)) &&
      (options.status === 'all' || item.active === (options.status === 'active')),
  );
  if (options.sort === 'volume') filtered.sort((a, b) => b.searchVolume - a.searchVolume);
  else if (options.sort === 'recency') {
    filtered.sort((a, b) => b.startedAtMs - a.startedAtMs);
  } else if (options.sort === 'title') {
    filtered.sort((a, b) => a.query.localeCompare(b.query, options.hl));
  }
  return filtered;
}
