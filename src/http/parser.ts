import { GoogleTrendsError, GoogleTrendsErrorCode } from '@/errors';

import { TRENDING_DATA_KEY } from './constants';

/** 响应是带安全前缀和长度行的 JSON 数组流，不能直接解析整个文本。 */
export function parseRpcResponse(text: string, rpcId: string): unknown {
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (start === -1) {
      if (character !== '[') continue;
      start = index;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '[') depth += 1;
    else if (character === ']') depth -= 1;
    if (depth !== 0) continue;

    let chunk: unknown;
    try {
      chunk = JSON.parse(text.slice(start, index + 1));
    } catch (cause) {
      throw invalidResponse('Google 趋势响应不是有效的 JSON', cause);
    }
    start = -1;
    if (!Array.isArray(chunk)) continue;
    const entry: unknown = chunk.find(
      (value: unknown) =>
        Array.isArray(value) && value[0] === 'wrb.fr' && value[1] === rpcId,
    );
    if (!Array.isArray(entry)) continue;
    if (typeof entry[2] !== 'string') {
      throw invalidResponse(`Google 趋势 ${rpcId} 未返回数据`);
    }
    try {
      return JSON.parse(entry[2]) as unknown;
    } catch (cause) {
      throw invalidResponse(`Google 趋势 ${rpcId} 数据解析失败`, cause);
    }
  }

  throw invalidResponse(`Google 趋势响应缺少 ${rpcId}，接口格式可能已变更`);
}

/** 丢弃页面无关部分，只保留榜单脚本；跨块保留标签与 UTF-8 解码状态。 */
export async function parseInitialData(
  body: ReadableStream<Uint8Array> | null,
): Promise<unknown> {
  if (body === null) throw invalidResponse('Google 趋势页面响应体为空');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inScript = false;
  let target = false;
  let scanned = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      while (buffer) {
        if (!inScript) {
          const opening = /<script\b[^>]*>/i.exec(buffer);
          if (!opening) {
            const partial = buffer.search(/<script\b/i);
            buffer = partial === -1 ? buffer.slice(-7) : buffer.slice(partial);
            break;
          }
          const className = /(?:^|\s)class\s*=\s*(["'])(.*?)\1/i.exec(opening[0])?.[2];
          target = className?.split(/\s+/).includes(TRENDING_DATA_KEY) ?? false;
          inScript = true;
          buffer = buffer.slice(opening.index + opening[0].length);
          scanned = 0;
        }
        const closing = /<\/script\s*>/i.exec(buffer.slice(scanned));
        if (!closing) {
          if (!target) buffer = buffer.slice(-10);
          scanned = target ? Math.max(0, buffer.length - 10) : 0;
          break;
        }
        if (target)
          return parseInitialDataScript(buffer.slice(0, scanned + closing.index));
        buffer = buffer.slice(scanned + closing.index + closing[0].length);
        inScript = false;
      }
      if (chunk.done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  throw invalidResponse(`Google 趋势页面缺少完整的 ${TRENDING_DATA_KEY} 榜单脚本`);
}

/** 只读取回调的顶层属性，不执行页面 JavaScript。 */
function parseInitialDataScript(script: string): unknown {
  const opening = /^\s*AF_initDataCallback\s*\(\s*\{/.exec(script);
  if (!opening) throw invalidResponse('Google 趋势榜单回调格式异常');
  const properties = new Map<string, string>();
  let index = opening[0].length;
  let complete = false;
  while (index < script.length) {
    const rest = script.slice(index);
    const property = /^\s*([a-zA-Z_$][\w$]*)\s*:\s*/.exec(rest);
    if (!property) {
      if (/^\s*\}\s*\)\s*;?\s*$/.test(rest)) {
        complete = true;
        break;
      }
      throw invalidResponse('Google 趋势榜单回调属性格式异常');
    }
    const name = property[1] ?? '';
    if (properties.has(name)) throw invalidResponse('Google 趋势榜单回调属性重复');
    index += property[0].length;
    const start = index;
    const stack: string[] = [];
    let quote = '';
    let escaped = false;
    for (; index < script.length; index += 1) {
      const character = script[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '[' || character === '{') stack.push(character);
      else if (character === ']' || character === '}') {
        if (character === '}' && stack.length === 0) break;
        if (stack.pop() !== (character === ']' ? '[' : '{')) {
          throw invalidResponse('Google 趋势榜单数据括号不匹配');
        }
      } else if (character === ',' && stack.length === 0) break;
    }
    if (quote || stack.length || index === script.length) {
      throw invalidResponse('Google 趋势榜单回调不完整');
    }
    properties.set(name, script.slice(start, index).trim());
    if (script[index] === ',') index += 1;
    else {
      if (!/^\}\s*\)\s*;?\s*$/.test(script.slice(index))) {
        throw invalidResponse('Google 趋势榜单回调结尾异常');
      }
      complete = true;
      break;
    }
  }
  if (!complete) throw invalidResponse('Google 趋势榜单回调不完整');
  const key = properties.get('key');
  if (key !== `'${TRENDING_DATA_KEY}'` && key !== `"${TRENDING_DATA_KEY}"`) {
    throw invalidResponse('Google 趋势榜单回调标识不匹配');
  }
  if (properties.has('isError') && properties.get('isError') !== 'false') {
    throw invalidResponse('Google 趋势页面返回榜单错误');
  }
  const data = properties.get('data');
  if (data === undefined) throw invalidResponse('Google 趋势榜单回调缺少数据');
  try {
    return JSON.parse(data) as unknown;
  } catch (cause) {
    throw invalidResponse('Google 趋势榜单数据不是有效的 JSON', cause);
  }
}

function invalidResponse(message: string, cause?: unknown): GoogleTrendsError {
  return new GoogleTrendsError(GoogleTrendsErrorCode.InvalidResponse, message, { cause });
}
