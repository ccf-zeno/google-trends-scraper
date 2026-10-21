import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import {
  fetchCountries,
  fetchTrendingNow,
  GoogleTrendsError,
  GoogleTrendsErrorCode,
} from '../src';
import type { TrendingNowOptions } from '../src';
import { countryPayload, fixedFetch, makeRow, rpcResponse } from './fixtures';

test('默认新加坡、过去24小时、前25条；不输出日志', async (t) => {
  const logger = mock.method(console, 'log', () => undefined);
  t.after(() => logger.mock.restore());
  const rows = Array.from({ length: 30 }, (_, index) => makeRow(index + 1));
  let calls = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('rpcids'), 'i0OFE');
    assert.equal(url.searchParams.get('hl'), 'en');
    assert.equal(init?.method, 'POST');
    const body = JSON.parse(
      new URLSearchParams(String(init.body)).get('f.req') ?? 'null',
    ) as unknown[][][];
    const rpc = body[0]?.[0];
    assert.ok(rpc);
    assert.equal(rpc[0], 'i0OFE');
    assert.deepEqual(JSON.parse(String(rpc[1])), [null, null, 'SG', 0, 'en', 24, 1]);
    assert.equal(new Headers(init.headers).has('Cookie'), false);
    return new Response(rpcResponse([null, rows]));
  };
  const result = await fetchTrendingNow({ fetch });
  assert.equal(calls, 1);
  assert.equal(result.geo, 'SG');
  assert.equal(result.hours, 24);
  assert.equal(result.sort, 'relevance');
  assert.equal(result.status, 'all');
  assert.equal(result.total, 30);
  assert.equal(result.filteredTotal, 30);
  assert.equal(result.items.length, 25);
  assert.equal(result.items[0]?.query, 'query 1');
  assert.equal(result.items[24]?.rawRank, 25);
  assert.equal(logger.mock.callCount(), 0);
});

test('支持大小写规范化、全部条目和零条截取', async () => {
  const fetch = fixedFetch([null, [makeRow(), makeRow(2)]]);
  const all = await fetchTrendingNow({ fetch, geo: ' sg ', hl: 'zh-cn', limit: 'all' });
  assert.equal(all.geo, 'SG');
  assert.equal(all.hl, 'zh-CN');
  assert.equal(all.items.length, 2);
  assert.equal((await fetchTrendingNow({ fetch, limit: 0 })).items.length, 0);
});

test('所有支持的时间窗口都会传给源站', async () => {
  for (const hours of [4, 24, 48, 168] as const) {
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      const payload = JSON.parse(
        new URLSearchParams(String(init?.body)).get('f.req') ?? 'null',
      ) as string[][][];
      const serialized = payload[0]?.[0]?.[1];
      assert.ok(serialized);
      assert.equal((JSON.parse(serialized) as unknown[])[5], hours);
      return new Response(rpcResponse([null, []]));
    };
    assert.equal((await fetchTrendingNow({ fetch, hours })).hours, hours);
  }
});

test('状态和分类本地过滤，相关性保留源站顺序', async () => {
  const fetch = fixedFetch([null, [makeRow(), makeRow(2), makeRow(3), makeRow(4)]]);
  const active = await fetchTrendingNow({ fetch, status: 'active', limit: 'all' });
  assert.deepEqual(
    active.items.map((item) => item.rawRank),
    [1, 3],
  );
  assert.deepEqual(
    active.items.map((item) => item.rank),
    [1, 2],
  );
  assert.equal(active.total, 4);
  assert.equal(active.filteredTotal, 2);
  const ended = await fetchTrendingNow({ fetch, status: 'ended', category: 14 });
  assert.deepEqual(
    ended.items.map((item) => item.rawRank),
    [2, 4],
  );
  assert.equal((await fetchTrendingNow({ fetch, category: 99 })).filteredTotal, 0);
});

test('按搜索量、时间和标题排序后重新编号', async () => {
  const fetch = fixedFetch([null, [makeRow(3), makeRow(1), makeRow(2)]]);
  for (const sort of ['volume', 'recency'] as const) {
    const result = await fetchTrendingNow({ fetch, sort });
    assert.deepEqual(
      result.items.map((item) => item.query),
      ['query 3', 'query 2', 'query 1'],
    );
    assert.deepEqual(
      result.items.map((item) => item.rank),
      [1, 2, 3],
    );
  }
  const title = await fetchTrendingNow({ fetch, sort: 'title' });
  assert.deepEqual(
    title.items.map((item) => item.query),
    ['query 1', 'query 2', 'query 3'],
  );
});

test('无效参数在请求前失败', async () => {
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('');
  };
  const cases: unknown[] = [
    null,
    [],
    'invalid',
    { geo: 'USA' },
    { geo: 'US-CA' },
    { geo: null },
    { hours: 12 },
    { hours: null },
    { limit: -1 },
    { limit: 1.5 },
    { limit: 'ALL' },
    { category: -1 },
    { category: '14' },
    { sort: 'bad' },
    { status: 'bad' },
    { hl: '' },
    { hl: 'invalid_locale' },
    { hl: 'en-123456789' },
  ];
  for (const options of cases) {
    const input =
      options !== null && typeof options === 'object' && !Array.isArray(options)
        ? { ...options, fetch }
        : options;
    await assert.rejects(
      fetchTrendingNow(input as TrendingNowOptions),
      (error: unknown) =>
        error instanceof GoogleTrendsError &&
        error.code === GoogleTrendsErrorCode.InvalidArgument,
    );
  }
  assert.equal(calls, 0);
});

test('一级国家清单使用独立RPC并支持语言参数', async () => {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).searchParams.get('rpcids'), 'DqDTgb');
    const request = JSON.parse(
      new URLSearchParams(String(init?.body)).get('f.req') ?? 'null',
    ) as string[][][];
    const args = request[0]?.[0]?.[1];
    assert.ok(args);
    assert.deepEqual(JSON.parse(args), ['zh-CN', 1, 0]);
    return new Response(rpcResponse(countryPayload(), 'DqDTgb'));
  };
  assert.equal((await fetchCountries({ fetch, hl: 'zh-CN' })).length, 2);
  await assert.rejects(
    fetchCountries(null as unknown as Parameters<typeof fetchCountries>[0]),
    GoogleTrendsError,
  );
});
