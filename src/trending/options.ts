import { GoogleTrendsError, GoogleTrendsErrorCode } from '@/errors';

import { ALLOWED_HOURS, ALLOWED_SORTS, ALLOWED_STATUSES, DEFAULTS } from './constants';
import type { NormalizedTrendingOptions, TrendingNowOptions } from './types';

export function normalizeTrendingOptions(
  options: TrendingNowOptions,
): NormalizedTrendingOptions {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw invalidArgument('options 必须是配置对象');
  }
  const geo = options.geo === undefined ? DEFAULTS.geo : options.geo;
  const hl = normalizeLocale(options.hl);
  const hours = options.hours === undefined ? DEFAULTS.hours : options.hours;
  const category = options.category === undefined ? DEFAULTS.category : options.category;
  const status = options.status === undefined ? DEFAULTS.status : options.status;
  const sort = options.sort === undefined ? DEFAULTS.sort : options.sort;
  const limit = options.limit === undefined ? DEFAULTS.limit : options.limit;

  if (typeof geo !== 'string' || !/^[a-z]{2}$/i.test(geo.trim())) {
    throw invalidArgument('geo 必须是两位国家或地区代码，例如 SG');
  }
  if (!(ALLOWED_HOURS as readonly unknown[]).includes(hours)) {
    throw invalidArgument('hours 只支持 4、24、48、168');
  }
  if (!Number.isSafeInteger(category) || category < 0) {
    throw invalidArgument('category 必须是非负整数，0 表示所有类别');
  }
  if (!(ALLOWED_STATUSES as readonly unknown[]).includes(status)) {
    throw invalidArgument('status 只支持 all、active、ended');
  }
  if (!(ALLOWED_SORTS as readonly unknown[]).includes(sort)) {
    throw invalidArgument('sort 只支持 relevance、volume、recency、title');
  }
  if (limit !== 'all' && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw invalidArgument('limit 必须是非负整数或 all');
  }

  return {
    geo: geo.trim().toUpperCase(),
    hl,
    hours,
    category,
    status,
    sort,
    limit: limit === 'all' ? Infinity : limit,
  };
}

export function normalizeLocale(hl: string = DEFAULTS.hl): string {
  if (typeof hl !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(hl.trim())) {
    throw invalidArgument('hl 必须是语言代码，例如 en 或 zh-CN');
  }
  try {
    return Intl.getCanonicalLocales(hl.trim())[0] ?? hl.trim();
  } catch {
    throw invalidArgument('hl 不是有效的语言代码');
  }
}

function invalidArgument(message: string): GoogleTrendsError {
  return new GoogleTrendsError(GoogleTrendsErrorCode.InvalidArgument, message);
}
