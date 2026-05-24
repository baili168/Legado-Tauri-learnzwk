import { ref, type Ref } from "vue";
import type { BookItem } from "@/stores";
import { useBookshelfStore, useBookSourceStore } from "@/stores";
import { exploreBookSource } from "./useBookSource";
import { getCachedExploreCategories } from "./useExploreCategoryCache";

export interface RecommendedBook {
  book: BookItem;
  fileName: string;
  sourceName: string;
}

interface RecommendationCache {
  ts: number;
  items: RecommendedBook[];
  topCategories: string[];
}

const CACHE_TTL = 60 * 60 * 1000;

const cache: Ref<RecommendationCache | null> = ref(null);
const recommendedBooks: Ref<RecommendedBook[]> = ref([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

function isCacheValid(): boolean {
  if (!cache.value) return false;
  return Date.now() - cache.value.ts < CACHE_TTL;
}

function analyzeUserPreferences(): string[] {
  const bookshelfStore = useBookshelfStore();
  const kindCounts: Record<string, number> = {};

  for (const book of bookshelfStore.books) {
    const kind = book.kind?.trim();
    if (kind && kind.length > 0) {
      kindCounts[kind] = (kindCounts[kind] || 0) + 1;
    }
  }

  const sorted = Object.entries(kindCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([kind]) => kind);

  return sorted;
}

function matchCategory(sourceCategories: string[], preferredKinds: string[]): string[] {
  const matches: string[] = [];
  for (const kind of preferredKinds) {
    const lower = kind.toLowerCase();
    for (const cat of sourceCategories) {
      const catLower = cat.toLowerCase();
      if (catLower.includes(lower) || lower.includes(catLower)) {
        if (!matches.includes(cat)) {
          matches.push(cat);
        }
        break;
      }
    }
  }
  return matches;
}

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getRecommendations(): Promise<void> {
  if (isCacheValid()) {
    recommendedBooks.value = cache.value!.items;
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const bookshelfStore = useBookshelfStore();
    const bookSourceStore = useBookSourceStore();

    const topCategories = analyzeUserPreferences();
    if (topCategories.length === 0) {
      recommendedBooks.value = [];
      isLoading.value = false;
      return;
    }

    const explorableSources = bookSourceStore.explorableSources.slice(0, 3);
    if (explorableSources.length === 0) {
      recommendedBooks.value = [];
      isLoading.value = false;
      return;
    }

    const allRecommendations: RecommendedBook[] = [];
    const seenUrls = new Set<string>();

    for (const source of explorableSources) {
      const categories = getCachedExploreCategories(source.fileName) ?? [];
      const matched = matchCategory(categories, topCategories).slice(0, 2);

      for (const cat of matched) {
        try {
          const result = await exploreBookSource(source.fileName, cat, 1);
          const books = Array.isArray(result) ? (result as BookItem[]) : [];
          for (const book of books) {
            if (!book.bookUrl || seenUrls.has(book.bookUrl)) continue;
            if (bookshelfStore.isOnShelf(book.bookUrl, source.fileName)) continue;
            seenUrls.add(book.bookUrl);
            allRecommendations.push({
              book: { ...book, kind: book.kind || cat },
              fileName: source.fileName,
              sourceName: source.name,
            });
          }
        } catch {
          // Skip failed source/category
        }
      }

      if (allRecommendations.length >= 10) break;
    }

    const shuffled = shuffle(allRecommendations).slice(0, 10);
    cache.value = { ts: Date.now(), items: shuffled, topCategories };
    recommendedBooks.value = shuffled;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    isLoading.value = false;
  }
}

export function useRecommendation() {
  return {
    recommendedBooks,
    isLoading,
    error,
    getRecommendations,
  };
}