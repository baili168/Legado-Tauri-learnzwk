import { ref } from "vue";

export type HealthStatus = "normal" | "slow" | "dead";

export interface HealthResult {
  status: HealthStatus;
  latency: number;
  testedAt: number;
}

const STORAGE_KEY = "legado-source-health";

function loadCache(): Record<string, HealthResult> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, HealthResult>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage full
  }
}

const healthCache = ref<Record<string, HealthResult>>(loadCache());

function getHealthStatus(sourceId: string): HealthResult | null {
  return healthCache.value[sourceId] ?? null;
}

function setHealthStatus(sourceId: string, result: HealthResult) {
  healthCache.value = { ...healthCache.value, [sourceId]: result };
  saveCache(healthCache.value);
}

async function testSource(
  source: { fileName: string; sourceKey: string; sourceDir: string },
  runSearch: (fileName: string, keyword: string, page: number, sourceDir?: string) => Promise<unknown>,
): Promise<HealthResult> {
  const start = performance.now();
  try {
    await runSearch(source.fileName, "测试搜索", 1, source.sourceDir);
    const latency = Math.round(performance.now() - start);
    let status: HealthStatus;
    if (latency < 3000) {
      status = "normal";
    } else if (latency < 10000) {
      status = "slow";
    } else {
      status = "dead";
    }
    const result: HealthResult = { status, latency, testedAt: Date.now() };
    setHealthStatus(source.sourceKey, result);
    return result;
  } catch {
    const latency = Math.round(performance.now() - start);
    const result: HealthResult = { status: "dead", latency, testedAt: Date.now() };
    setHealthStatus(source.sourceKey, result);
    return result;
  }
}

async function testAllSources(
  sources: Array<{ fileName: string; sourceKey: string; sourceDir: string }>,
  runSearch: (fileName: string, keyword: string, page: number, sourceDir?: string) => Promise<unknown>,
  onProgress?: (current: number, total: number) => void,
): Promise<Map<string, HealthResult>> {
  const results = new Map<string, HealthResult>();
  const CONCURRENCY = 5;
  let completed = 0;
  const total = sources.length;

  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    const batch = sources.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (src) => {
        const result = await testSource(src, runSearch);
        results.set(src.sourceKey, result);
        completed++;
        onProgress?.(completed, total);
        return result;
      }),
    );

    for (const r of batchResults) {
      if (r.status === "rejected") {
        completed++;
        onProgress?.(completed, total);
      }
    }
  }

  return results;
}

export function useSourceHealth() {
  return {
    healthCache,
    getHealthStatus,
    loadCache,
    testSource,
    testAllSources,
  };
}