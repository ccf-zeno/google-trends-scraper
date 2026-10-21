import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchTrendingNow, GoogleTrendsError, GoogleTrendsErrorCode } from '../src';
import type { TrendingNowOptions } from '../src';
import { makeRow, rpcResponse } from './fixtures';

function hasCode(code: GoogleTrendsErrorCode): (error: unknown) => boolean {
  return (error) => error instanceof GoogleTrendsError && error.code === code;
}

test('HTTP错误携带状态和限流提示，不重试、不降级', async () => {
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('limited', { status: 429, headers: { 'retry-after': '60' } });
  };
  await assert.rejects(fetchTrendingNow({ fetch }), (error: unknown) => {
    assert.ok(error instanceof GoogleTrendsError);
    assert.equal(error.code, GoogleTrendsErrorCode.HttpError);
    assert.equal(error.status, 429);
    assert.equal(error.retryAfter, '60');
    return true;
  });
  assert.equal(calls, 1);
});

test('网络错误保留原始cause', async () => {
  const cause = new Error('connection reset');
  const fetch: typeof globalThis.fetch = async () => {
    throw cause;
  };
  await assert.rejects(fetchTrendingNow({ fetch }), (error: unknown) => {
    assert.ok(error instanceof GoogleTrendsError);
    assert.equal(error.code, GoogleTrendsErrorCode.NetworkError);
    assert.equal(error.cause, cause);
    return true;
  });
});

test('请求超时会取消底层请求', async () => {
  let aborted = false;
  const fetch: typeof globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => {
          aborted = true;
          reject(init.signal?.reason);
        },
        { once: true },
      );
    });
  await assert.rejects(
    fetchTrendingNow({ fetch, timeoutMs: 10 }),
    hasCode(GoogleTrendsErrorCode.Timeout),
  );
  assert.equal(aborted, true);
});

test('响应体读取也在超时范围内', async () => {
  const fetch: typeof globalThis.fetch = async (_input, init) =>
    new Response(
      new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener(
            'abort',
            () => controller.error(init.signal?.reason),
            { once: true },
          );
        },
      }),
    );
  await assert.rejects(
    fetchTrendingNow({ fetch, timeoutMs: 10 }),
    hasCode(GoogleTrendsErrorCode.Timeout),
  );
});

test('调用前取消不会发请求', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('');
  };
  await assert.rejects(
    fetchTrendingNow({ fetch, signal: controller.signal }),
    hasCode(GoogleTrendsErrorCode.Aborted),
  );
  assert.equal(calls, 0);
});

test('调用中取消会向底层传播', async () => {
  const controller = new AbortController();
  const fetch: typeof globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
        once: true,
      });
      controller.abort(new Error('手动取消'));
    });
  await assert.rejects(
    fetchTrendingNow({ fetch, signal: controller.signal }),
    hasCode(GoogleTrendsErrorCode.Aborted),
  );
});

test('响应解析失败使用结构错误而不是网络错误', async () => {
  const fetch: typeof globalThis.fetch = async () => new Response('<html>captcha</html>');
  await assert.rejects(
    fetchTrendingNow({ fetch }),
    hasCode(GoogleTrendsErrorCode.InvalidResponse),
  );
});

test('请求配置非法时立即失败', async () => {
  for (const options of [
    { timeoutMs: 0 },
    { timeoutMs: -1 },
    { timeoutMs: Infinity },
    { timeoutMs: 2 ** 31 },
    { timeoutMs: null },
    { fetch: 123 },
    { fetch: null },
    { signal: {} },
    { signal: null },
  ]) {
    await assert.rejects(
      fetchTrendingNow(options as unknown as TrendingNowOptions),
      hasCode(GoogleTrendsErrorCode.InvalidArgument),
    );
  }
});

test('未注入请求实现时使用运行时原生fetch', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () => new Response(rpcResponse([null, [makeRow()]]));
  assert.equal((await fetchTrendingNow()).items.length, 1);
});
