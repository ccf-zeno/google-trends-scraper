import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import type * as PublicApi from '../src';

const { fetchCountries, fetchTrendingNow } = (await import(
  pathToFileURL(`${process.cwd()}/dist/esm/index.js`).href
)) as typeof PublicApi;
const countries = await fetchCountries({ hl: 'zh-CN' });
assert.ok(countries.some((country) => country.geo === 'SG'));
assert.ok(countries.every((country) => /^[A-Z]{2}$/.test(country.geo)));
console.log(JSON.stringify({ countryCount: countries.length }));
for (const options of [
  { geo: 'SG', hl: 'en', hours: 24 },
  { geo: 'SG', hl: 'en', hours: 4 },
  { geo: 'SG', hl: 'en', hours: 48 },
  { geo: 'SG', hl: 'en', hours: 168 },
  { geo: 'US', hl: 'en', hours: 24 },
  { geo: 'JP', hl: 'ja', hours: 168 },
] as const) {
  const result = await fetchTrendingNow({ ...options, limit: 'all' });
  assert.equal(result.geo, options.geo);
  assert.equal(result.hl, options.hl);
  assert.equal(result.hours, options.hours);
  assert.ok(result.total > 0, `${options.geo}/${options.hours} 未取得榜单`);
  assert.equal(result.items.length, result.total);
  assert.equal(result.filteredTotal, result.total);
  console.log(
    JSON.stringify({
      ...options,
      total: result.total,
      sample: result.items[0],
    }),
  );
}
