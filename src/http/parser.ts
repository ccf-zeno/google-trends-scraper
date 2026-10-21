import { GoogleTrendsError, GoogleTrendsErrorCode } from '@/errors';

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

function invalidResponse(message: string, cause?: unknown): GoogleTrendsError {
  return new GoogleTrendsError(GoogleTrendsErrorCode.InvalidResponse, message, { cause });
}
