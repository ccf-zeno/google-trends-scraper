# Google Trends Scraper

[English](https://github.com/ccf-zeno/google-trends-scraper/blob/main/README_EN.md) | 中文

它能帮你拿到 Google Trends 的热门搜索榜。想看哪个国家或地区就传哪个，时间可选最近 4、24、48 小时或过去 7 天；还能按分类筛选、只看活跃或已结束的趋势、按相关性／搜索量／开始时间／标题排序，取多少条、界面用什么语言都由你定。

> 本项目不是 Google 官方 API 或 SDK，与 Google 无隶属关系。仅支持 Trending Now，不包含关键词历史热度、地区兴趣分布、关联查询等完整 Google Trends Explore 能力。网页内部接口可能变动或被限流，不保证长期可用。
>
> 无需 Google API Key、登录账号或浏览器；不需要安装 Chromium。仅提供代码调用的 Node.js SDK，适合趋势监控、内容选题和关键词研究。

## 安装

```bash
pnpm add google-trends-scraper
```

## 使用示例

### 获取热门趋势

```ts
import { fetchTrendingNow } from 'google-trends-scraper';
import type { TrendingNowResult } from 'google-trends-scraper';

const result: TrendingNowResult = await fetchTrendingNow({
  geo: 'SG',
  hours: 24,
  limit: 25,
});

console.log(result.items);
```

CommonJS：

```js
const { fetchTrendingNow } = require('google-trends-scraper');

fetchTrendingNow({ geo: 'SG' })
  .then((result) => console.log(result.items))
  .catch(console.error);
```

### 返回类型

`fetchTrendingNow` 返回 `Promise<TrendingNowResult>`；包入口同时导出 `TrendingItem`，可直接用于类型标注或解构。

```ts
interface TrendingNowResult {
  /** 实际生效的国家／地区代码，已转大写 */
  geo: string;
  /** 实际生效的界面语言 */
  hl: string;
  /** 实际生效的时间窗口 */
  hours: 4 | 24 | 48 | 168;
  /** 实际生效的分类编号，0 表示全部 */
  category: number;
  /** 实际生效的状态筛选 */
  status: 'all' | 'active' | 'ended';
  /** 实际生效的排序方式 */
  sort: 'relevance' | 'volume' | 'recency' | 'title';
  /** 源站本次返回的趋势池条数，不保证是该国家所有搜索的完整集合 */
  total: number;
  /** 本地筛选后、截取前的条数 */
  filteredTotal: number;
  items: TrendingItem[];
}

interface TrendingItem {
  /** 当前输出中的序号 */
  rank: number;
  /** 源站响应中的原始序号 */
  rawRank: number;
  query: string;
  normalizedQuery: string;
  /** 展示档位下限，5000 表示页面上的 5000+，不是精确搜索次数 */
  searchVolume: number;
  /** 源站返回的增长百分比，不额外推算 */
  increasePercentage: number;
  /** 开始时间，Unix 毫秒时间戳，可直接交给 new Date() 或 dayjs() */
  startedAtMs: number;
  /** 结束时间，Unix 毫秒时间戳；null 表示仍活跃 */
  endedAtMs: number | null;
  active: boolean;
  trendBreakdown: string[];
  categoryIds: number[];
  /** 源站携带的新闻引用，不是文章链接 */
  newsReferences: { id: number; language: string; geo: string }[];
}
```

### 返回结构示例

```json
{
  "geo": "SG",
  "hl": "en",
  "hours": 24,
  "category": 0,
  "status": "all",
  "sort": "relevance",
  "total": 1,
  "filteredTotal": 1,
  "items": [
    {
      "rank": 1,
      "rawRank": 1,
      "query": "example search",
      "normalizedQuery": "example search",
      "searchVolume": 5000,
      "increasePercentage": 1000,
      "startedAtMs": 1792416600000,
      "endedAtMs": null,
      "active": true,
      "trendBreakdown": ["example search"],
      "categoryIds": [14],
      "newsReferences": []
    }
  ]
}
```

### 按国家获取趋势

```ts
import { fetchCountries, fetchTrendingNow } from 'google-trends-scraper';

const countries = await fetchCountries({ hl: 'zh-CN' });
console.log(countries);

const japan = await fetchTrendingNow({ geo: 'JP', hours: 24 });
console.log(japan.items);
```

### 错误码

| 错误码             | 含义                                               |
| ------------------ | -------------------------------------------------- |
| `INVALID_ARGUMENT` | 参数不合法                                         |
| `HTTP_ERROR`       | 源站非成功响应，附带 `status`，可能有 `retryAfter` |
| `NETWORK_ERROR`    | 网络连接失败，原始错误保存在 `cause`               |
| `TIMEOUT`          | 请求或响应体读取超时                               |
| `ABORTED`          | 调用方取消                                         |
| `INVALID_RESPONSE` | 返回结构异常，可能是接口变更或验证页               |

## 常见问题

### 它是官方 Google Trends API 吗？

不是。它请求 Trending Now 网页使用的内部 RPC 接口，不需要 API Key，但接口没有公开兼容性承诺。

### 这是浏览器爬虫还是 HTTP 请求？

直接发送 HTTP POST 并解析结构化响应，不打开浏览器、不解析网页 HTML。

## 免责声明

本项目与 Google 无隶属关系，也不是官方接口，只是对 Trending Now 网页数据的非官方整理。它不保证数据的准确、完整或实时，请勿用于任何需要以官方口径呈现的场景。

数据来自网页内部接口，可能随时变动、限流或失效，不保证长期可用。请自行确认使用方式符合 Google 的服务条款和当地法律法规，相关风险由使用者自行承担。

项目按 MIT 许可「原样」提供，不附带任何形式的担保，作者不对使用本项目产生的后果负责。
