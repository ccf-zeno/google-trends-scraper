export interface RequestOptions {
  /** 可注入支持代理或测试替身的请求实现。 */
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}
