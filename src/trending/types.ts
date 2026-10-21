import type { RequestOptions } from '@/http';

import type { ALLOWED_HOURS, ALLOWED_SORTS, ALLOWED_STATUSES } from './constants';

export type TrendingHours = (typeof ALLOWED_HOURS)[number];
export type TrendingSort = (typeof ALLOWED_SORTS)[number];
export type TrendingStatus = (typeof ALLOWED_STATUSES)[number];

export interface LocaleOptions extends RequestOptions {
  hl?: string;
}

export interface TrendingNowOptions extends LocaleOptions {
  geo?: string;
  hours?: TrendingHours;
  category?: number;
  status?: TrendingStatus;
  sort?: TrendingSort;
  /** 默认 25；all 保留全部，不表示只请求源站第一页。 */
  limit?: number | 'all';
}

export interface TrendingCountry {
  geo: string;
  name: string;
}

export interface TrendingNewsReference {
  id: number;
  language: string;
  geo: string;
}

export interface TrendingItem {
  rank: number;
  rawRank: number;
  query: string;
  normalizedQuery: string;
  /** 搜索量档位下限，5000 代表页面上的 5000+，不是精确次数。 */
  searchVolume: number;
  increasePercentage: number;
  /** 开始时间，Unix 毫秒时间戳，可直接交给 new Date() 或 dayjs()。 */
  startedAtMs: number;
  /** 结束时间，Unix 毫秒时间戳；null 表示该趋势仍活跃。 */
  endedAtMs: number | null;
  active: boolean;
  trendBreakdown: string[];
  categoryIds: number[];
  newsReferences: TrendingNewsReference[];
}

export interface TrendingNowResult {
  geo: string;
  hl: string;
  hours: TrendingHours;
  category: number;
  status: TrendingStatus;
  sort: TrendingSort;
  /** 源站本次返回的趋势池数量。 */
  total: number;
  /** 本地过滤后、截取前的数量。 */
  filteredTotal: number;
  items: TrendingItem[];
}

export interface NormalizedTrendingOptions {
  geo: string;
  hl: string;
  hours: TrendingHours;
  category: number;
  status: TrendingStatus;
  sort: TrendingSort;
  limit: number;
}
