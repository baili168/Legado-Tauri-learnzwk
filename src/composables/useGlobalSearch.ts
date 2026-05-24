import { ref } from "vue";
import { useBookshelfStore } from "@/stores";

export interface SearchResult {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  chapterIndex: number;
  chapterTitle: string;
  matchedText: string;
  matchStart: number;
}

export interface BookSearchGroup {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverUrl?: string;
  results: SearchResult[];
  matchCount: number;
}

export function useGlobalSearch() {
  const bookshelfStore = useBookshelfStore();
  const searching = ref(false);
  const progress = ref({ done: 0, total: 0 });

  async function search(query: string): Promise<BookSearchGroup[]> {
    const kw = query.trim().toLowerCase();
    if (!kw) {
      return [];
    }

    const books = bookshelfStore.books.filter((b) => b.sourceType !== "video" && b.sourceType !== "music");
    const bookGroups: BookSearchGroup[] = [];

    searching.value = true;
    progress.value = { done: 0, total: books.length };

    try {
      for (const book of books) {
        let cachedIndices: Set<number>;
        try {
          cachedIndices = await bookshelfStore.getCachedIndices(book.id);
        } catch {
          cachedIndices = new Set();
        }

        if (cachedIndices.size === 0) {
          progress.value.done += 1;
          continue;
        }

        let chapters: Array<{ name: string; url: string }> = [];
        try {
          chapters = await bookshelfStore.getChapters(book.id);
        } catch {
          // 无章节目录，跳过
        }

        const results: SearchResult[] = [];

        for (const chapterIndex of cachedIndices) {
          let content: string | null = null;
          try {
            content = await bookshelfStore.getContent(book.id, chapterIndex);
          } catch {
            // 缓存读取失败，跳过
          }

          if (!content) {
            continue;
          }

          const lowerContent = content.toLowerCase();
          let searchFrom = 0;
          while (true) {
            const pos = lowerContent.indexOf(kw, searchFrom);
            if (pos === -1) {
              break;
            }

            const excerptStart = Math.max(0, pos - 25);
            const excerptEnd = Math.min(content.length, pos + kw.length + 25);
            let excerpt = content.slice(excerptStart, excerptEnd).replace(/\n/g, " ");

            if (excerptStart > 0) {
              excerpt = "..." + excerpt;
            }
            if (excerptEnd < content.length) {
              excerpt = excerpt + "...";
            }

            results.push({
              bookId: book.id,
              bookTitle: book.name,
              bookAuthor: book.author,
              chapterIndex,
              chapterTitle: chapters[chapterIndex]?.name ?? `第${chapterIndex + 1}章`,
              matchedText: excerpt,
              matchStart: pos - excerptStart + (excerptStart > 0 ? 3 : 0),
            });

            searchFrom = pos + kw.length;

            if (results.length >= 50) {
              break;
            }
          }

          if (results.length >= 50) {
            break;
          }
        }

        if (results.length > 0) {
          bookGroups.push({
            bookId: book.id,
            bookTitle: book.name,
            bookAuthor: book.author,
            coverUrl: book.coverUrl,
            results,
            matchCount: results.length,
          });
        }

        progress.value.done += 1;
      }
    } finally {
      searching.value = false;
    }

    bookGroups.sort((a, b) => b.matchCount - a.matchCount);

    return bookGroups;
  }

  return {
    search,
    searching,
    progress,
  };
}