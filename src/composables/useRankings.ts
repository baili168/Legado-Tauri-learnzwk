import { ref, shallowRef } from "vue";
import type { BookItem } from "@/stores";
import { useScriptBridgeStore } from "@/stores";

export type RankingType = "hot" | "collected" | "new" | "updated";

interface RankingCacheEntry {
  books: BookItem[];
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

const rankingCache = new Map<string, RankingCacheEntry>();

function cacheKey(fileName: string, type: RankingType): string {
  return `${fileName}::${type}`;
}

const RANKING_CATEGORY_MAP: Record<RankingType, string[]> = {
  hot: ["热门", "排行", "热门榜", "人气榜", "推荐榜", "热搜榜", "最热", "畅销"],
  collected: ["收藏", "收藏榜", "追读榜", "订阅榜", "书签榜"],
  new: ["新书", "新书榜", "最新入库", "最新", "新品"],
  updated: ["更新", "更新榜", "最近更新", "连载榜"],
};

export function useRankings() {
  const scriptBridgeStore = useScriptBridgeStore();
  const { runExplore } = scriptBridgeStore;

  const rankingBooks = shallowRef<BookItem[]>([]);
  const loading = ref(false);
  const error = ref("");

  function getFromCache(fileName: string, type: RankingType): BookItem[] | null {
    const key = cacheKey(fileName, type);
    const entry = rankingCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.books;
    }
    return null;
  }

  function setCache(fileName: string, type: RankingType, books: BookItem[]): void {
    const key = cacheKey(fileName, type);
    rankingCache.set(key, { books, timestamp: Date.now() });
  }

  function clearCache(fileName?: string): void {
    if (fileName) {
      for (const key of rankingCache.keys()) {
        if (key.startsWith(`${fileName}::`)) {
          rankingCache.delete(key);
        }
      }
    } else {
      rankingCache.clear();
    }
  }

  async function fetchRankings(fileName: string, type: RankingType): Promise<void> {
    if (!fileName) {
      error.value = "未选择书源";
      return;
    }

    const cached = getFromCache(fileName, type);
    if (cached) {
      rankingBooks.value = cached;
      return;
    }

    loading.value = true;
    error.value = "";

    try {
      const candidates = RANKING_CATEGORY_MAP[type];

      const raw = await runExplore(fileName, "GETALL");
      let matchingCategory = "";
      if (Array.isArray(raw)) {
        const categories = raw.filter((v): v is string => typeof v === "string");
        for (const cat of categories) {
          const lower = cat.toLowerCase();
          if (candidates.some((c) => lower.includes(c.toLowerCase()))) {
            matchingCategory = cat;
            break;
          }
        }
        if (!matchingCategory && categories.length > 0) {
          matchingCategory = categories[0];
        }
      }

      if (!matchingCategory) {
        error.value = "该书源无排行榜分类";
        rankingBooks.value = [];
        return;
      }

      const booksRaw = await runExplore(fileName, matchingCategory, 1);
      if (Array.isArray(booksRaw)) {
        const books = booksRaw.filter(
          (b): b is BookItem =>
            b !== null && typeof b === "object" && typeof (b as BookItem).name === "string",
        );
        rankingBooks.value = books;
        setCache(fileName, type, books);
      } else {
        rankingBooks.value = [];
        error.value = "排行榜数据格式异常";
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      rankingBooks.value = [];
    } finally {
      loading.value = false;
    }
  }

  return {
    rankingBooks,
    loading,
    error,
    fetchRankings,
    clearCache,
  };
}