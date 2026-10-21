import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import manifest from '../package.json';

const root = process.cwd();
const temporary = await mkdtemp(join(tmpdir(), 'google-trends-package-'));
try {
  const output = execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary],
    { cwd: root, encoding: 'utf8' },
  );
  const [tarball] = JSON.parse(output) as Array<{
    filename: string;
    files: Array<{ path: string }>;
  }>;
  assert.ok(tarball);
  const files = new Set(tarball.files.map((file) => file.path));
  const entry = manifest.exports['.'];
  for (const path of [
    manifest.types,
    entry.import.types,
    entry.import.default,
    entry.require.types,
    entry.require.default,
    'README.md',
    'LICENSE',
  ]) {
    assert.ok(files.has(path.replace(/^\.\//, '')), `缺少发布文件：${path}`);
  }
  assert.ok(
    [...files].every((file) =>
      /^(dist\/(?:esm|cjs)\/|package\.json$|README\.md$|LICENSE$)/.test(file),
    ),
  );

  await writeFile(join(temporary, 'package.json'), '{"private":true,"type":"module"}');
  execFileSync(
    'npm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      join(temporary, tarball.filename),
    ],
    { cwd: temporary, stdio: 'inherit' },
  );

  // 这里只验证发布入口，采集行为统一由离线单元测试覆盖。
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as esm from '${manifest.name}';
    const cjs = createRequire(import.meta.url)('${manifest.name}');
    const exports = ['fetchTrendingNow', 'fetchCountries', 'GoogleTrendsError', 'GoogleTrendsErrorCode'].sort();
    for (const sdk of [esm, cjs]) {
      assert.deepEqual(Object.keys(sdk).sort(), exports);
      for (const name of ['fetchTrendingNow', 'fetchCountries', 'GoogleTrendsError']) {
        assert.equal(typeof sdk[name], 'function');
      }
      assert.equal(typeof sdk.GoogleTrendsErrorCode, 'object');
    }
  `,
    ],
    { cwd: temporary, stdio: 'inherit' },
  );

  const consumer = `
    import { fetchTrendingNow, fetchCountries, GoogleTrendsError, GoogleTrendsErrorCode } from '${manifest.name}';
    import type { TrendingNowOptions, TrendingNowResult, TrendingItem, TrendingCountry } from '${manifest.name}';
    const options: TrendingNowOptions = { geo: 'SG', hours: 24, sort: 'volume', status: 'active', fetch: globalThis.fetch };
    const trends: Promise<TrendingNowResult> = fetchTrendingNow(options);
    const items: Promise<TrendingItem[]> = trends.then((result) => result.items);
    const newsId: Promise<number | undefined> = items.then((rows) => rows[0]?.newsReferences[0]?.id);
    const countries: Promise<TrendingCountry[]> = fetchCountries({ hl: 'zh-CN', timeoutMs: 1000 });
    void [trends, items, newsId, countries, GoogleTrendsError, GoogleTrendsErrorCode];
    // @ts-expect-error 不支持任意小时数
    fetchTrendingNow({ hours: 12 });
  `;
  await writeFile(join(temporary, 'consumer.mts'), consumer);
  await writeFile(join(temporary, 'consumer.cts'), consumer);
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--types',
      'node',
      '--typeRoots',
      resolve(root, 'node_modules/@types'),
      'consumer.mts',
      'consumer.cts',
    ],
    { cwd: temporary, stdio: 'inherit' },
  );
  console.log('发布验证通过：压缩包内容、ESM/CJS 入口和类型声明均正常。');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
