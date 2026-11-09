import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchTrendingNow, GoogleTrendsError, GoogleTrendsErrorCode } from '../src';
import { parseInitialData } from '../src/http/parser';
import { makeRow, pageResponse } from './fixtures';

function invalidResponse(error: unknown): boolean {
  return (
    error instanceof GoogleTrendsError &&
    error.code === GoogleTrendsErrorCode.InvalidResponse
  );
}

test('标签、回调和多字节字符跨块时仍完整提取榜单', async () => {
  const row = makeRow();
  row[0] = '中文 😀 [a] "b" \\ c, isError:true, data:[null]';
  const payload = [null, [row]];
  const html = pageResponse(payload);
  const bytes = new TextEncoder().encode(html);
  for (const size of [1, 2, 7, 16, 64, bytes.length]) {
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === bytes.length) controller.close();
        else {
          controller.enqueue(bytes.slice(offset, offset + size));
          offset = Math.min(offset + size, bytes.length);
        }
      },
    });
    assert.deepEqual(await parseInitialData(body), payload);
    assert.equal(body.locked, false);
  }
});

test('提取完成即取消后续读取，不请求尾部内容', async () => {
  let cancelled = false;
  let reads = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        reads += 1;
        assert.equal(reads, 1);
        controller.enqueue(new TextEncoder().encode(pageResponse([null, []])));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  assert.deepEqual(await parseInitialData(body), [null, []]);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test('跳过大量无关内容和其他数据脚本，兼容属性顺序及尾逗号', async () => {
  const script = `<SCRIPT nonce='test' CLASS='extra ds:0'>
    AF_initDataCallback({hash: 'test', sideChannel: {nested:["},data:"]},
      data: [null, []], key: "ds:0", isError: false,});
  </SCRIPT>`;
  const html = `<style>${'x'.repeat(1_500_000)}</style>
    <script data-class="ds:0">AF_initDataCallback({key:'ds:0',data:["er"],isError:true});</script>
    <script class="ds:1">AF_initDataCallback({key:'ds:1',data:["Singapore"]});</script>
    ${script}`;
  assert.deepEqual(await parseInitialData(new Response(html).body), [null, []]);
});

test('缺失、错误、截断和非JSON数据不能变成空榜成功', async () => {
  const scripts = [
    '',
    "AF_initDataCallback({key:'ds:1',data:[null,[]]});",
    "AF_initDataCallback({key:'ds:0',data:[null,[]],isError:true});",
    "AF_initDataCallback({isError:true,key:'ds:0',data:[null,[]]});",
    "AF_initDataCallback({key:'ds:0',data:['er'],isError:true,});",
    "AF_initDataCallback({key:'ds:0',hash:'test'});",
    "AF_initDataCallback({key:'ds:0',data:[null,[]],data:[null,[]]});",
    "AF_initDataCallback({key:'ds:0',data:[invalid]});",
    "AF_initDataCallback({key:'ds:0',data:[null,[]}",
    "AF_initDataCallback({key:'ds:0',data:[null,[]],",
    "AF_initDataCallback({key:'ds:0',data:[null,[]]}); extra()",
    "AF_initDataCallback({key:'ds:0',data:JSON.parse('[null,[]]')});",
  ];
  const htmls = [
    '',
    '<html>请完成验证</html>',
    pageResponse([null, []]).replaceAll('ds:0', 'ds:1'),
    pageResponse([null, []]).split('</script>')[0] ?? '',
    ...scripts.map((script) => `<script class="ds:0">${script}</script>`),
  ];
  for (const html of htmls) {
    await assert.rejects(parseInitialData(new Response(html).body), invalidResponse);
  }
  await assert.rejects(parseInitialData(null), invalidResponse);
});

test('回调数据存在但结构异常仍由业务解析器拒绝', async () => {
  for (const payload of [['er'], null, [], [null, null], [null, ['bad']]]) {
    const fetch: typeof globalThis.fetch = async () =>
      new Response(pageResponse(payload));
    await assert.rejects(fetchTrendingNow({ fetch }), invalidResponse);
  }
  const fetch: typeof globalThis.fetch = async () =>
    new Response(pageResponse([null, []]));
  const result = await fetchTrendingNow({ fetch });
  assert.equal(result.total, 0);
  assert.equal(result.filteredTotal, 0);
  assert.deepEqual(result.items, []);
});

test('错误回调也释放响应流', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          `<script class="ds:0">AF_initDataCallback({key:'ds:0',data:["er"],isError:true,});</script>`,
        ),
      );
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(parseInitialData(body), invalidResponse);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test('响应流中途失败保留网络错误原因', async () => {
  const cause = new Error('响应体连接中断');
  const fetch: typeof globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(cause);
        },
      }),
    );
  await assert.rejects(fetchTrendingNow({ fetch }), (error: unknown) => {
    assert.ok(error instanceof GoogleTrendsError);
    assert.equal(error.code, GoogleTrendsErrorCode.NetworkError);
    assert.equal(error.cause, cause);
    return true;
  });
});
