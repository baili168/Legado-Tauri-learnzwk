import { ref, watch, type Ref } from "vue";

interface ComicPage {
  remoteUrl: string;
  src: string;
  cachedSrc: string | null;
  loaded: boolean;
  failed: boolean;
  pending: boolean;
  retryFailed: boolean;
}

export interface ComicPreloadEntry {
  index: number;
  priority: "high" | "medium" | "low";
}

function computeQueue(
  pagesLength: number,
  visibleIndices: Set<number>,
): ComicPreloadEntry[] {
  if (visibleIndices.size === 0) {
    return Array.from({ length: pagesLength }, (_, i) => ({
      index: i,
      priority: "low" as const,
    }));
  }

  const sorted = [...visibleIndices].toSorted((a, b) => a - b);
  const minVisible = sorted[0];
  const maxVisible = sorted[sorted.length - 1];

  const mediumStart = Math.max(0, minVisible - 3);
  const mediumEnd = Math.min(pagesLength - 1, maxVisible + 3);

  const result: ComicPreloadEntry[] = [];
  for (let i = 0; i < pagesLength; i++) {
    if (visibleIndices.has(i)) {
      result.push({ index: i, priority: "high" });
    } else if (i >= mediumStart && i <= mediumEnd) {
      result.push({ index: i, priority: "medium" });
    } else {
      result.push({ index: i, priority: "low" });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  result.sort((a, b) => order[a.priority] - order[b.priority]);

  return result;
}

export function useComicPreloader(
  pages: Ref<ComicPage[]>,
  visibleImages: Ref<Set<number>>,
) {
  const preloadQueue = ref<ComicPreloadEntry[]>([]);

  function recalculate() {
    preloadQueue.value = computeQueue(pages.value.length, visibleImages.value);
  }

  watch(visibleImages, () => {
    recalculate();
  });

  watch(
    () => pages.value.length,
    () => {
      recalculate();
    },
  );

  recalculate();

  return { preloadQueue };
}