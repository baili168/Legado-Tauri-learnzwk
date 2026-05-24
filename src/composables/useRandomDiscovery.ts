import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useMessage } from "naive-ui";
import type { BookItem } from "@/stores";
import { useScriptBridgeStore, useBookSourceStore, useBookshelfStore } from "@/stores";
import { getCoverImageUrl } from "@/utils/coverImage";

export function useRandomDiscovery() {
  const scriptBridgeStore = useScriptBridgeStore();
  const bookSourceStore = useBookSourceStore();
  const bookshelfStore = useBookshelfStore();

  const { runExplore } = scriptBridgeStore;
  const { books: shelfBooks, shelfIndex } = storeToRefs(bookshelfStore);
  const message = useMessage();

  const currentRandomBook = ref<{
    book: BookItem;
    sourceName: string;
    fileName: string;
    sourceType: string;
  } | null>(null);
  const isLoading = ref(false);

  const preferredCategories = computed(() => {
    const shelf = shelfBooks.value;
    if (!shelf || shelf.length === 0) return [] as string[];

    const kindCounts = new Map<string, number>();
    for (const entry of shelf) {
      const kind = entry.kind?.trim();
      if (kind && kind !== "未知") {
        kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
      }
    }

    return Array.from(kindCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
  });

  function isInShelf(bookUrl: string, fileName: string): boolean {
    return shelfIndex.value.has(`${bookUrl}|${fileName}`);
  }

  function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  async function getRandomBook(excludeIds: string[] = []): Promise<void> {
    isLoading.value = true;
    currentRandomBook.value = null;

    try {
      const explorableSources = bookSourceStore.explorableSources;
      if (explorableSources.length === 0) {
        message.warning("暂无可用的发现书源");
        return;
      }

      const shuffledSources = shuffleArray(explorableSources);

      for (const source of shuffledSources) {
        const rawCategories = await runExplore(source.fileName, "GETALL");
        if (!Array.isArray(rawCategories)) continue;

        const categories = rawCategories.filter((v): v is string => typeof v === "string");
        if (categories.length === 0) continue;

        const prefs = preferredCategories.value;
        let orderedCategories = categories;

        if (prefs.length > 0) {
          const matching = categories.filter((cat) =>
            prefs.some((p) => cat.toLowerCase().includes(p.toLowerCase())),
          );
          const nonMatching = categories.filter(
            (cat) => !prefs.some((p) => cat.toLowerCase().includes(p.toLowerCase())),
          );
          orderedCategories = [...shuffleArray(matching), ...shuffleArray(nonMatching)];
        } else {
          orderedCategories = shuffleArray(categories);
        }

        for (const category of orderedCategories) {
          try {
            const rawBooks = await runExplore(source.fileName, category, 1);
            if (!Array.isArray(rawBooks)) continue;

            const books = rawBooks.filter(
              (b): b is BookItem =>
                b !== null &&
                typeof b === "object" &&
                typeof (b as BookItem).name === "string" &&
                typeof (b as BookItem).bookUrl === "string",
            );

            const availableBooks = books.filter(
              (b) =>
                !isInShelf(b.bookUrl, source.fileName) &&
                !excludeIds.includes(b.bookUrl),
            );

            if (availableBooks.length === 0) continue;

            const picked = availableBooks[Math.floor(Math.random() * availableBooks.length)];

            currentRandomBook.value = {
              book: picked,
              sourceName: source.name,
              fileName: source.fileName,
              sourceType: source.sourceType,
            };
            return;
          } catch {
            continue;
          }
        }
      }

      message.info("所有书源中未找到可推荐的书籍");
    } catch (e: unknown) {
      message.error(`随机发现失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      isLoading.value = false;
    }
  }

  async function refresh(excludeIds: string[] = []): Promise<void> {
    await getRandomBook(excludeIds);
  }

  async function addToBookshelf(): Promise<void> {
    const entry = currentRandomBook.value;
    if (!entry) return;

    try {
      await bookshelfStore.addToShelf(
        {
          name: entry.book.name,
          author: entry.book.author || undefined,
          bookUrl: entry.book.bookUrl,
          coverUrl: getCoverImageUrl(entry.book.coverUrl) || undefined,
          intro: entry.book.intro || undefined,
          kind: entry.book.kind || undefined,
        },
        entry.fileName,
        entry.sourceName,
      );
      message.success(`「${entry.book.name}」已加入书架`);
    } catch (e: unknown) {
      message.error(`加入书架失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function clear() {
    currentRandomBook.value = null;
  }

  return {
    currentRandomBook,
    isLoading,
    getRandomBook,
    refresh,
    addToBookshelf,
    clear,
  };
}