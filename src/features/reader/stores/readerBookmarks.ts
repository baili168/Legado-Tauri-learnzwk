import { defineStore } from "pinia";
import { computed } from "vue";
import { useDynamicConfig } from "@/composables/useDynamicConfig";

export type HighlightColor = "yellow" | "blue" | "green" | "pink";

export interface BookmarkEntry {
  id: string;
  /** 书架书籍的 bookUrl（本地文件可能为空字符串） */
  bookUrl: string;
  /** 文件名，作为备用唯一标识 */
  fileName: string;
  chapterIndex: number;
  chapterName: string;
  text: string;
  createdAt: number;
}

export interface HighlightAnnotation {
  id: string;
  bookUrl: string;
  fileName: string;
  chapterIndex: number;
  chapterName: string;
  startOffset: number;
  endOffset: number;
  text: string;
  color: HighlightColor;
  note?: string;
  tags?: string[];
  createdAt: number;
}

type BookmarkItem = BookmarkEntry | HighlightAnnotation;

interface BookmarksState {
  items: BookmarkItem[];
}

export const useReaderBookmarksStore = defineStore("readerBookmarks", () => {
  const config = useDynamicConfig<BookmarksState>({
    namespace: "reader-bookmarks",
    version: 2,
    defaults: () => ({ items: [] }),
  });

  const bookmarks = computed(() => config.state.items as BookmarkEntry[]);
  const highlights = computed(() =>
    config.state.items.filter((item): item is HighlightAnnotation => "color" in item),
  );

  function getChapterBookmarks(
    bookUrl: string,
    fileName: string,
    chapterIndex: number,
  ): BookmarkEntry[] {
    return (config.state.items as BookmarkEntry[]).filter(
      (b) => b.fileName === fileName && b.chapterIndex === chapterIndex && b.bookUrl === bookUrl,
    );
  }

  function getChapterHighlights(fileName: string, chapterIndex: number): HighlightAnnotation[] {
    return highlights.value.filter(
      (h) => h.fileName === fileName && h.chapterIndex === chapterIndex,
    );
  }

  function findBookmark(
    bookUrl: string,
    fileName: string,
    chapterIndex: number,
    text: string,
  ): BookmarkEntry | undefined {
    return (config.state.items as BookmarkEntry[]).find(
      (b) =>
        b.fileName === fileName &&
        b.chapterIndex === chapterIndex &&
        b.text === text &&
        b.bookUrl === bookUrl,
    );
  }

  function findHighlight(id: string): HighlightAnnotation | undefined {
    return highlights.value.find((h) => h.id === id);
  }

  async function addBookmark(entry: Omit<BookmarkEntry, "id" | "createdAt">): Promise<void> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const items: BookmarkItem[] = [...config.state.items, { ...entry, id, createdAt: Date.now() }];
    await config.replace({ items });
  }

  async function addHighlight(entry: Omit<HighlightAnnotation, "id" | "createdAt">): Promise<void> {
    const id = `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const items: BookmarkItem[] = [...config.state.items, { ...entry, id, createdAt: Date.now() }];
    await config.replace({ items });
  }

  async function updateHighlight(
    id: string,
    patch: Partial<Pick<HighlightAnnotation, "note" | "tags" | "color">>,
  ): Promise<void> {
    const items = config.state.items.map((item) => {
      if ("color" in item && item.id === id) {
        return { ...item, ...patch };
      }
      return item;
    });
    await config.replace({ items });
  }

  async function removeBookmark(id: string): Promise<void> {
    const items = config.state.items.filter((b) => b.id !== id);
    await config.replace({ items });
  }

  async function removeHighlight(id: string): Promise<void> {
    const items = config.state.items.filter((item) => {
      if ("color" in item) return item.id !== id;
      return true;
    });
    await config.replace({ items });
  }

  function getHighlightColorEmoji(color: HighlightColor): string {
    const emojiMap: Record<HighlightColor, string> = {
      yellow: "🟡",
      blue: "🔵",
      green: "🟢",
      pink: "🩷",
    };
    return emojiMap[color];
  }

  async function exportHighlightsAsMarkdown(fileName: string): Promise<string> {
    const fileHighlights = highlights.value.filter((h) => h.fileName === fileName);
    if (fileHighlights.length === 0) {
      return "";
    }

    const sorted = [...fileHighlights].sort((a, b) => a.chapterIndex - b.chapterIndex);
    const lines: string[] = ["# 阅读笔记\n"];

    let currentChapter = "";
    for (const highlight of sorted) {
      if (highlight.chapterName !== currentChapter) {
        currentChapter = highlight.chapterName;
        lines.push(`\n## ${currentChapter}\n`);
      }

      const colorEmoji = getHighlightColorEmoji(highlight.color);
      lines.push(`> "${highlight.text}" - [${highlight.chapterName}] ${colorEmoji}`);

      if (highlight.note) {
        lines.push(`\n**笔记:**\n${highlight.note}`);
      }

      if (highlight.tags && highlight.tags.length > 0) {
        lines.push(`\n**标签:** ${highlight.tags.map((t) => `#${t}`).join(" ")}`);
      }

      lines.push("\n---\n");
    }

    return lines.join("\n");
  }

  return {
    bookmarks,
    highlights,
    getChapterBookmarks,
    getChapterHighlights,
    findBookmark,
    findHighlight,
    addBookmark,
    addHighlight,
    updateHighlight,
    removeBookmark,
    removeHighlight,
    exportHighlightsAsMarkdown,
  };
});
