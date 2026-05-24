import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ShelfBook } from "@/composables/useBookshelf";

export type SmartGroupType = "unread" | "reading" | "finished";

export interface SmartGroup {
  id: SmartGroupType;
  label: string;
  icon: string;
  bookIds: string[];
  order: number;
}

const STORAGE_KEY = "legado-smart-groups";

function getDefaults(): SmartGroup[] {
  return [
    { id: "unread", label: "未读", icon: "book-open", bookIds: [], order: 0 },
    { id: "reading", label: "正在读", icon: "book-marked", bookIds: [], order: 1 },
    { id: "finished", label: "已读完", icon: "check-circle", bookIds: [], order: 2 },
  ];
}

function loadFromStorage(): SmartGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SmartGroup[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // corrupted data, use defaults
  }
  return getDefaults();
}

function persistToStorage(groups: SmartGroup[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // storage full or unavailable
  }
}

export const useSmartGroupsStore = defineStore("smartGroups", () => {
  const groups = ref<SmartGroup[]>(loadFromStorage());

  function classifyBook(bookId: string, bookData: Pick<ShelfBook, "readChapterIndex" | "totalChapters">): SmartGroupType {
    const { readChapterIndex, totalChapters } = bookData;
    if (readChapterIndex < 0) return "unread";
    if (totalChapters > 0 && readChapterIndex >= totalChapters - 1) return "finished";
    return "reading";
  }

  function autoClassifyAll(bookshelfBooks: ShelfBook[]) {
    const defaults = getDefaults();
    const newGroups = defaults.map((g) => ({ ...g, bookIds: [] as string[] }));
    for (const book of bookshelfBooks) {
      const type = classifyBook(book.id, book);
      const group = newGroups.find((g) => g.id === type);
      if (group) group.bookIds.push(book.id);
    }
    groups.value = newGroups;
    persistToStorage(groups.value);
  }

  function removeFromAllGroups(bookId: string) {
    for (const group of groups.value) {
      group.bookIds = group.bookIds.filter((id) => id !== bookId);
    }
    persistToStorage(groups.value);
  }

  function getGroupByType(type: SmartGroupType): SmartGroup | undefined {
    return groups.value.find((g) => g.id === type);
  }

  const groupCounts = computed(() => {
    const counts: Record<SmartGroupType, number> = { unread: 0, reading: 0, finished: 0 };
    for (const group of groups.value) {
      counts[group.id] = group.bookIds.length;
    }
    return counts;
  });

  return {
    groups,
    groupCounts,
    classifyBook,
    autoClassifyAll,
    removeFromAllGroups,
    getGroupByType,
  };
});