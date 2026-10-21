import { GoogleTrendsError, GoogleTrendsErrorCode } from '@/errors';

import { DEFAULT_TIMEOUT_MS, PAGE_URL, RPC_URL } from './constants';
import { parseRpcResponse } from './parser';
import type { RequestOptions } from './types';

/** 超时覆盖请求和响应体读取；不自动重试，避免放大源站限流。 */
export async function requestRpc(
  rpcId: string,
  args: unknown[],
  hl: string,
  options: RequestOptions,
): Promise<unknown> {
  const fetchImpl = options.fetch === undefined ? globalThis.fetch : options.fetch;
  const timeoutMs =
    options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
  validateRequestOptions(fetchImpl, timeoutMs);
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new GoogleTrendsError(
      GoogleTrendsErrorCode.InvalidArgument,
      'signal 必须是 AbortSignal',
    );
  }
  if (options.signal?.aborted) throw abortedError(options.signal.reason);

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('请求超时'));
  }, timeoutMs);

  const query = new URLSearchParams({ rpcids: rpcId, 'source-path': '/trending', hl });
  const body = new URLSearchParams({
    'f.req': JSON.stringify([[[rpcId, JSON.stringify(args), null, 'generic']]]),
  });

  try {
    const response = await fetchImpl(`${RPC_URL}?${query}`, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'user-agent': 'Mozilla/5.0',
        origin: 'https://trends.google.com',
        referer: PAGE_URL,
      },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      const retryAfter = response.headers.get('retry-after');
      throw new GoogleTrendsError(
        GoogleTrendsErrorCode.HttpError,
        `Google 趋势接口请求失败：HTTP ${response.status}`,
        { status: response.status, ...(retryAfter === null ? {} : { retryAfter }) },
      );
    }
    const text = await response.text();
    if (controller.signal.aborted) throw controller.signal.reason;
    return parseRpcResponse(text, rpcId);
  } catch (cause) {
    if (options.signal?.aborted) throw abortedError(cause);
    if (timedOut) {
      throw new GoogleTrendsError(
        GoogleTrendsErrorCode.Timeout,
        `Google 趋势请求超过 ${timeoutMs} 毫秒`,
        { cause },
      );
    }
    if (cause instanceof GoogleTrendsError) throw cause;
    throw new GoogleTrendsError(
      GoogleTrendsErrorCode.NetworkError,
      'Google 趋势网络请求失败',
      { cause },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

function validateRequestOptions(fetchImpl: unknown, timeoutMs: number): void {
  if (typeof fetchImpl !== 'function') {
    throw new GoogleTrendsError(
      GoogleTrendsErrorCode.InvalidArgument,
      'fetch 必须是函数，请使用 Node.js 22.13 或更新版本',
    );
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new GoogleTrendsError(
      GoogleTrendsErrorCode.InvalidArgument,
      'timeoutMs 必须是 1 至 2147483647 的整数',
    );
  }
}

function abortedError(cause: unknown): GoogleTrendsError {
  return new GoogleTrendsError(GoogleTrendsErrorCode.Aborted, 'Google 趋势请求已取消', {
    cause,
  });
}
