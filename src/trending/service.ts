import { GoogleTrendsError, GoogleTrendsErrorCode } from '@/errors';
import { requestRpc } from '@/http';

import { COUNTRIES_RPC_ID, SORT_KEYS, TRENDING_RPC_ID } from './constants';
import { filterTrendingItems } from './filter';
import { normalizeLocale, normalizeTrendingOptions } from './options';
import { parseCountries, parseTrendingRows } from './parser';
import type {
  LocaleOptions,
  TrendingCountry,
  TrendingNowOptions,
  TrendingNowResult,
} from './types';

/** 调用网页内部接口；保留源站相关性排序，再做本地过滤和数量截取。 */
export async function fetchTrendingNow(
  options: TrendingNowOptions = {},
): Promise<TrendingNowResult> {
  const normalized = normalizeTrendingOptions(options);
  const { geo, hl, hours, category, sort, status, limit } = normalized;
  const payload = await requestRpc(
    TRENDING_RPC_ID,
    [null, null, geo, category, hl, hours, SORT_KEYS[sort]],
    hl,
    options,
  );
  const items = parseTrendingRows(payload, geo);
  const filtered = filterTrendingItems(items, normalized);

  return {
    geo,
    hl,
    hours,
    category,
    status,
    sort,
    total: items.length,
    filteredTotal: filtered.length,
    items: filtered.slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 })),
  };
}

export async function fetchCountries(
  options: LocaleOptions = {},
): Promise<TrendingCountry[]> {
  validateObject(options);
  const hl = normalizeLocale(options.hl);
  const payload = await requestRpc(COUNTRIES_RPC_ID, [hl, 1, 0], hl, options);
  return parseCountries(payload);
}

function validateObject(options: unknown): void {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new GoogleTrendsError(
      GoogleTrendsErrorCode.InvalidArgument,
      'options 必须是配置对象',
    );
  }
}
