/**
 * 服务端 HTTP 工具：统一超时、UA、JSON 解析与日志
 * 所有平台请求必须走 fetchWithTimeout，默认 15 秒超时
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/** 平台请求统一的浏览器式 User-Agent */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 超时错误标记（平台适配器据此区分超时与其他错误） */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超时（${ms}ms）`);
    this.name = 'TimeoutError';
  }
}

export interface FetchOptions extends RequestInit {
  /** 超时毫秒数，默认 15000 */
  timeoutMs?: number;
}

/**
 * 带超时的 fetch，失败时抛出异常（由平台适配器 try-catch 降级）
 * @returns 解析后的 JSON（泛型 T 由调用方保证）
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
        ...(init.headers ?? {}),
      },
      // 路由处理器的出站请求不缓存（价格必须实时）
      cache: 'no-store',
    });
    if (!res.ok) {
      // 429 限流：记录日志并抛出（前端会展示「该平台暂时不可用」）
      if (res.status === 429) {
        console.warn(`[http] 429 限流: ${url}`);
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 带超时的 fetch 文本（用于有路网 HTML 抓取）
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`[http] 429 限流: ${url}`);
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** 简单进程内互斥限频器：保证同一 key 的请求间隔 ≥ intervalMs */
const lastRunMap = new Map<string, number>();
export async function rateLimit(key: string, intervalMs: number): Promise<void> {
  const now = Date.now();
  const last = lastRunMap.get(key) ?? 0;
  const wait = last + intervalMs - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRunMap.set(key, Date.now());
}
