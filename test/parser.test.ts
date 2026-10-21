import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GoogleTrendsError, GoogleTrendsErrorCode } from '../src';
import { parseRpcResponse } from '../src/http/parser';
import { parseCountries, parseTrendingRows } from '../src/trending/parser';
import { countryPayload, makeRow, rpcResponse } from './fixtures';

function invalidResponse(error: unknown): boolean {
  return (
    error instanceof GoogleTrendsError &&
    error.code === GoogleTrendsErrorCode.InvalidResponse
  );
}

test('解析安全前缀、分块长度和其他 RPC', () => {
  const row = makeRow();
  row[0] = 'term [a] "b" \\ c';
  const payload = [null, [row]];
  const text = `)]}'\n123\n${rpcResponse([], 'other')}\n450\n${rpcResponse(payload)}`;
  assert.deepEqual(parseRpcResponse(text, 'i0OFE'), payload);
});

test('异常或不完整响应不能当作空榜成功', () => {
  for (const text of [
    '<html>captcha</html>',
    '',
    '[[]',
    '[[invalid]]',
    rpcResponse([], 'other'),
    '[["wrb.fr","i0OFE",null]]',
    '[["wrb.fr","i0OFE","invalid"]]',
  ])
    assert.throws(() => parseRpcResponse(text, 'i0OFE'), invalidResponse);
});

test('转换字段并保留源站排名和新闻引用', () => {
  const [item, ended] = parseTrendingRows([null, [makeRow(1), makeRow(2)]], 'SG');
  assert.ok(item);
  assert.ok(ended);
  assert.equal(item.rank, 1);
  assert.equal(item.rawRank, 1);
  assert.equal(item.query, 'query 1');
  assert.equal(item.normalizedQuery, 'normalized 1');
  assert.equal(item.searchVolume, 100);
  assert.equal(item.increasePercentage, 1000);
  assert.equal(item.active, true);
  assert.equal(item.endedAtMs, null);
  assert.equal(item.startedAtMs, 1_792_416_660_000);
  assert.deepEqual(item.newsReferences, [
    { id: 4_888_528_579, language: 'en', geo: 'SG' },
  ]);
  assert.equal(ended.active, false);
  assert.equal(ended.endedAtMs, 1_792_420_200_000);
});

test('缺少可选字段时使用稳定形状', () => {
  const row = makeRow();
  row[9] = ['valid', null, 123];
  row[10] = [14, 'bad', -1, Infinity];
  row[11] = [[1, 'en', 'SG'], [null], null];
  row[12] = '';
  const [item] = parseTrendingRows([null, [row]], 'SG');
  assert.ok(item);
  assert.deepEqual(item.trendBreakdown, ['valid']);
  assert.deepEqual(item.categoryIds, [14]);
  assert.deepEqual(item.newsReferences, [{ id: 1, language: 'en', geo: 'SG' }]);
  assert.equal(item.normalizedQuery, item.query);
});

test('错误字段和错误国家会抛出结构错误', () => {
  const cases: Array<[number, unknown]> = [
    [0, ''],
    [0, null],
    [2, 'US'],
    [3, null],
    [3, []],
    [3, [-1]],
    [3, [1e20]],
    [4, ['invalid']],
    [6, null],
    [6, -1],
    [8, Infinity],
  ];
  for (const [index, value] of cases) {
    const row = makeRow();
    row[index] = value;
    assert.throws(() => parseTrendingRows([null, [row]], 'SG'), invalidResponse);
  }
});

test('真正的空榜与缺失榜单区别处理', () => {
  assert.deepEqual(parseTrendingRows([null, []], 'SG'), []);
  for (const payload of [null, [], [null], [null, null], [null, ['bad']]]) {
    assert.throws(() => parseTrendingRows(payload, 'SG'), invalidResponse);
  }
});

test('国家清单去重并排除二级地区和我的位置', () => {
  assert.deepEqual(parseCountries(countryPayload()), [
    { geo: 'SG', name: 'Singapore' },
    { geo: 'US', name: 'United States' },
  ]);
  for (const payload of [
    null,
    [],
    [[]],
    [[[['US-CA', 'California']]]],
    [[[['SG', '']]]],
  ]) {
    assert.throws(() => parseCountries(payload), invalidResponse);
  }
});
