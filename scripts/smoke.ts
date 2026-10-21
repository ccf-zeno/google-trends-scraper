import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import type * as PublicApi from '../src';

const { fetchCountries, fetchTrendingNow } = (await import(
  pathToFileURL(`${process.cwd()}/dist/esm/index.js`).href
)) as typeof PublicApi;
const countries = await fetchCountries({ hl: 'zh-CN' });
assert.ok(countries.some((country) => country.geo === 'SG'));
assert.ok(countries.every((country) => /^[A-Z]{2}$/.test(country.geo)));
const result = await fetchTrendingNow({ geo: 'SG', hours: 24, limit: 25 });
assert.equal(result.items.length, Math.min(25, result.filteredTotal));
assert.equal(result.geo, 'SG');
assert.equal(result.hours, 24);
console.log(JSON.stringify({ countryCount: countries.length, ...result }, null, 2));
