import { GoogleTrendsError, GoogleTrendsErrorCode } from '@/errors';

import type { TrendingCountry, TrendingItem, TrendingNewsReference } from './types';

export function parseTrendingRows(payload: unknown, geo: string): TrendingItem[] {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw invalidResponse(`Google 趋势 ${geo} 榜单格式异常`);
  }
  return (payload[1] as unknown[]).map((row, index) =>
    parseTrendingRow(row, geo, index + 1),
  );
}

/** 只读取一级菜单，排除省州和“我的位置”条目。 */
export function parseCountries(payload: unknown): TrendingCountry[] {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw invalidResponse('Google 趋势国家列表格式异常');
  }
  const countries = new Map<string, TrendingCountry>();
  for (const group of payload[0] as unknown[]) {
    const country: unknown = Array.isArray(group) ? group[0] : null;
    if (
      !Array.isArray(country) ||
      typeof country[0] !== 'string' ||
      !/^[A-Z]{2}$/.test(country[0]) ||
      typeof country[1] !== 'string' ||
      !country[1].trim()
    ) {
      throw invalidResponse('Google 趋势一级国家格式异常');
    }
    countries.set(country[0], { geo: country[0], name: country[1] });
  }
  if (countries.size === 0) throw invalidResponse('Google 趋势国家列表为空');
  return [...countries.values()];
}

function parseTrendingRow(value: unknown, geo: string, rank: number): TrendingItem {
  if (
    !Array.isArray(value) ||
    typeof value[0] !== 'string' ||
    !value[0].trim() ||
    value[2] !== geo ||
    !isNonnegativeNumber(value[6]) ||
    !isNonnegativeNumber(value[8])
  ) {
    throw invalidResponse(`Google 趋势 ${geo} 第 ${rank} 条数据格式异常`);
  }
  const startedAtMs = parseTimestampMs(value[3]);
  if (startedAtMs === null) throw invalidResponse('Google 趋势缺少开始时间');
  const endedAtMs = parseTimestampMs(value[4]);
  const newsReferences = parseNewsReferences(value[11]);

  return {
    rank,
    rawRank: rank,
    query: value[0],
    normalizedQuery: typeof value[12] === 'string' && value[12] ? value[12] : value[0],
    searchVolume: value[6],
    increasePercentage: value[8],
    startedAtMs,
    endedAtMs,
    active: endedAtMs === null,
    trendBreakdown: Array.isArray(value[9])
      ? (value[9] as unknown[]).filter((term): term is string => typeof term === 'string')
      : [],
    categoryIds: Array.isArray(value[10])
      ? (value[10] as unknown[]).filter(
          (id): id is number =>
            typeof id === 'number' && Number.isSafeInteger(id) && id >= 0,
        )
      : [],
    newsReferences,
  };
}

function parseNewsReferences(value: unknown): TrendingNewsReference[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).flatMap((ref) =>
    Array.isArray(ref) &&
    typeof ref[0] === 'number' &&
    Number.isSafeInteger(ref[0]) &&
    ref[0] >= 0 &&
    typeof ref[1] === 'string' &&
    typeof ref[2] === 'string'
      ? [{ id: ref[0], language: ref[1], geo: ref[2] }]
      : [],
  );
}

/** 源站返回的是 Unix 秒，这里统一转成毫秒，并拦下越界值。 */
function parseTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const seconds: unknown = Array.isArray(value) ? value[0] : null;
  if (!isNonnegativeNumber(seconds)) throw invalidResponse('Google 趋势时间戳格式异常');
  const milliseconds = seconds * 1000;
  if (!Number.isFinite(new Date(milliseconds).getTime()))
    throw invalidResponse('Google 趋势时间戳超出有效范围');
  return milliseconds;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function invalidResponse(message: string): GoogleTrendsError {
  return new GoogleTrendsError(GoogleTrendsErrorCode.InvalidResponse, message);
}
