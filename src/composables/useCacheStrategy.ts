/**
 * useCacheStrategy — 离线缓存策略
 *
 * 面向 Android WebView 的 Cache API 封装，提供：
 *   - 缓存优先策略（getCacheFirst）：适合静态资源（CSS/JS/字体）
 *   - 网络优先策略（getNetworkFirst）：适合 API 数据，离线时回退缓存
 *   - 预缓存资源列表（precacheUrls）：在应用启动时批量写缓存
 *
 * 用法：
 *   import { getCacheFirst, getNetworkFirst, precacheUrls } from '@/composables/useCacheStrategy'
 */

const CACHE_NAME = "legado-v1";

const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|gif|ico)$/i;

function isCacheSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

function openCache(): Promise<Cache> {
  return caches.open(CACHE_NAME);
}

/**
 * 缓存优先策略：先从 Cache 读取，命中直接返回；未命中则 fetch 并缓存。
 * 适合字体、CSS、JS、图标等不常变化的资源。
 */
export async function getCacheFirst(url: string): Promise<Response> {
  if (!isCacheSupported()) {
    return fetch(url);
  }

  const cache = await openCache();
  const cached = await cache.match(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (response.ok) {
    cache.put(url, response.clone());
  }
  return response;
}

/**
 * 网络优先策略：先尝试 fetch，成功则更新缓存并返回；网络失败时回退缓存。
 * 如果提供了 fallback 离线占位 URL，则在无网络无缓存时返回占位数据。
 *
 * @param url       - 请求的资源 URL
 * @param fallback  - 离线兜底的占位资源 URL（可选，如离线提示图）
 */
export async function getNetworkFirst(url: string, fallback?: string): Promise<Response> {
  if (!isCacheSupported()) {
    try {
      return await fetch(url);
    } catch {
      if (fallback) return fetch(fallback);
      throw new Error(`Network request failed: ${url}`);
    }
  }

  const cache = await openCache();

  try {
    const response = await fetch(url);
    if (response.ok) {
      cache.put(url, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(url);
    if (cached) return cached;
    if (fallback) {
      const fbCached = await cache.match(fallback);
      if (fbCached) return fbCached;
      return fetch(fallback);
    }
    throw new Error(`Network request failed and no cache available: ${url}`);
  }
}

/**
 * 预缓存一组资源 URL。
 * 逐个 fetch 并写入 Cache，遇到失败跳过继续。
 * 建议在 requestIdleCallback 中调用以避免阻塞主线程。
 *
 * @param urls - 要预缓存的资源 URL 列表
 */
export async function precacheUrls(urls: string[]): Promise<void> {
  if (!isCacheSupported() || urls.length === 0) return;

  const cache = await openCache();
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const cached = await cache.match(url);
      if (cached) return;
      const response = await fetch(url, { cache: "no-cache" });
      if (response.ok) {
        await cache.put(url, response);
      }
    }),
  );

  if (import.meta.env.DEV) {
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[CacheStrategy] precache ${succeeded}/${urls.length} 完成`);
  }
}

/**
 * 判断 URL 是否为静态资源（根据文件扩展名匹配）。
 */
export function isStaticAsset(url: string): boolean {
  return STATIC_EXTENSIONS.test(url);
}

/**
 * 针对 Response 自动决定是否缓存。
 * 如果响应的 URL 匹配静态资源扩展名，则写入 Cache。
 *
 * @param response - fetch 返回的 Response 对象
 */
export async function autoCacheIfStatic(response: Response): Promise<void> {
  if (!isCacheSupported() || !response.ok) return;

  const url = response.url;
  if (isStaticAsset(url)) {
    const cache = await openCache();
    const cached = await cache.match(url);
    if (!cached) {
      cache.put(url, response.clone());
    }
  }
}
