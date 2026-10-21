# Google Trends Scraper

Get the Google Trends trending searches list. Pass any country or region code and you get back what people are searching for right now; pick a window of the last 4, 24, or 48 hours or the past 7 days; filter by category, show only active or ended trends, sort by relevance / search volume / start time / title, and decide how many results to keep and which interface language to use.

> This project is not an official Google API or SDK and is not affiliated with Google. It only supports Trending Now, and does not cover the full Google Trends Explore capabilities such as historical keyword interest, interest by region, or related queries. The internal web endpoint may change or rate-limit requests, so long-term availability is not guaranteed.
>
> No Google API key, sign-in, or browser is required, and there is no need to install Chromium. It is a code-only Node.js SDK, suited to trend monitoring, content planning, and keyword research.

## Install

```bash
pnpm add google-trends-scraper
```

## Usage

### Fetch trending searches

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

CommonJS:

```js
const { fetchTrendingNow } = require('google-trends-scraper');

fetchTrendingNow({ geo: 'SG' })
  .then((result) => console.log(result.items))
  .catch(console.error);
```

### Return types

`fetchTrendingNow` returns `Promise<TrendingNowResult>`; the package entry also exports `TrendingItem`, which you can use for type annotations or destructuring.

```ts
interface TrendingNowResult {
  /** Country/region code actually used, uppercased */
  geo: string;
  /** Interface language actually used */
  hl: string;
  /** Time window actually used */
  hours: 4 | 24 | 48 | 168;
  /** Category number actually used, 0 means all */
  category: number;
  /** Status filter actually used */
  status: 'all' | 'active' | 'ended';
  /** Sort order actually used */
  sort: 'relevance' | 'volume' | 'recency' | 'title';
  /** Number of trends the source returned this time; not guaranteed to be every search in that country */
  total: number;
  /** Number of items after local filtering, before truncation */
  filteredTotal: number;
  items: TrendingItem[];
}

interface TrendingItem {
  /** Position in the current output */
  rank: number;
  /** Original position in the source response */
  rawRank: number;
  query: string;
  normalizedQuery: string;
  /** Lower bound of the displayed bucket, 5000 means "5000+" on the page, not an exact count */
  searchVolume: number;
  /** Growth percentage returned by the source, not extrapolated */
  increasePercentage: number;
  /** Start time, Unix timestamp in milliseconds, ready for new Date() or dayjs() */
  startedAtMs: number;
  /** End time, Unix timestamp in milliseconds; null means still active */
  endedAtMs: number | null;
  active: boolean;
  trendBreakdown: string[];
  categoryIds: number[];
  /** News references carried by the source, not article links */
  newsReferences: { id: number; language: string; geo: string }[];
}
```

### Example response

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

### Fetch trends by country

```ts
import { fetchCountries, fetchTrendingNow } from 'google-trends-scraper';

const countries = await fetchCountries({ hl: 'zh-CN' });
console.log(countries);

const japan = await fetchTrendingNow({ geo: 'JP', hours: 24 });
console.log(japan.items);
```

### Error codes

| Code               | Meaning                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `INVALID_ARGUMENT` | Invalid argument                                                              |
| `HTTP_ERROR`       | Non-success response from the source, carries `status`, possibly `retryAfter` |
| `NETWORK_ERROR`    | Connection failed, the original error is kept in `cause`                      |
| `TIMEOUT`          | Request or response body read timed out                                       |
| `ABORTED`          | Cancelled by the caller                                                       |
| `INVALID_RESPONSE` | Unexpected response shape, possibly an endpoint change or a verification page |

## FAQ

### Is this the official Google Trends API?

No. It calls the internal RPC endpoint used by the Trending Now web page. No API key is required, but the endpoint makes no public compatibility guarantee.

### Is this a browser scraper or an HTTP client?

It sends an HTTP POST and parses the structured response. No browser is opened and no page HTML is parsed.

## Disclaimer

This project is not affiliated with Google and is not an official endpoint; it is an unofficial wrapper around Trending Now web data. It does not guarantee that the data is accurate, complete, or real-time, so do not use it where an official source is required.

The data comes from an internal web endpoint that may change, rate-limit, or stop working at any time, so long-term availability is not guaranteed. Make sure your use complies with Google's terms of service and your local laws; you bear the associated risk.

The project is provided "as is" under the MIT license, without warranty of any kind, and the author is not responsible for consequences arising from its use.
