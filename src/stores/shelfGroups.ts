import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { BookTag, BookTagRelation, ShelfGroup } from "@/types/shelfGroup";
import { useDynamicConfig } from "@/composables/useDynamicConfig";
import { useBookshelfStore } from "@/stores/bookshelf";

interface ShelfGroupsState {
  groups: ShelfGroup[];
  activeGroupId: string;
  lastReadBookId: string | null;
  allGroupEnabled: boolean;
  bookGroupMap: Record<string, string>;
  tags: BookTag[];
  bookTags: BookTagRelation[];
}

const DEFAULT_STATE: ShelfGroupsState = {
  groups: [],
  activeGroupId: "all",
  lastReadBookId: null,
  allGroupEnabled: true,
  bookGroupMap: {},
  tags: [],
  bookTags: [],
};

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

const TAG_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];

export const useShelfGroupsStore = defineStore("shelfGroups", () => {
  const bookshelfStore = useBookshelfStore();

  const store = useDynamicConfig<ShelfGroupsState>({
    namespace: "ui.shelfGroups",
    version: 2,
    defaults: () => ({ ...DEFAULT_STATE }),
    migrate: (ctx) => {
      if (ctx.storedVersion === 1) {
        const old = ctx.storedData as Record<string, unknown> | null;
        if (old) {
          return {
            groups: (old.groups as ShelfGroup[]) ?? [],
            activeGroupId: (old.activeGroupId as string) ?? "all",
            lastReadBookId: (old.lastReadBookId as string) ?? null,
            allGroupEnabled: (old.allGroupEnabled as boolean) ?? true,
            bookGroupMap: (old.bookGroupMap as Record<string, string>) ?? {},
            tags: [],
            bookTags: [],
          };
        }
      }
      return null;
    },
  });

  const selectedTagIds = ref<string[]>([]);

  const groupsWithAll = computed<ShelfGroup[]>(() => {
    const allGroupEnabled = store.state.allGroupEnabled ?? true;
    const allGroup: ShelfGroup = {
      id: "all",
      name: "全部书籍",
      createdAt: 0,
      enabled: allGroupEnabled,
      order: -1,
    };
    return [allGroup, ...store.state.groups];
  });

  const visibleGroups = computed(() => {
    return groupsWithAll.value.filter((g) => g.enabled);
  });

  function sortByLastRead(books: typeof bookshelfStore.books) {
    return [...books].toSorted((a, b) => {
      const aHasRead = a.lastReadAt > 0;
      const bHasRead = b.lastReadAt > 0;
      if (aHasRead && !bHasRead) return -1;
      if (!aHasRead && bHasRead) return 1;
      if (aHasRead && bHasRead) return b.lastReadAt - a.lastReadAt;
      return b.addedAt - a.addedAt;
    });
  }

  const filteredBooks = computed(() => {
    const activeId = store.state.activeGroupId;
    let books = [...bookshelfStore.books];

    if (activeId === "all") {
      books = sortByLastRead(books);
    } else {
      books = sortByLastRead(books.filter((b) => store.state.bookGroupMap[b.id] === activeId));
    }

    if (selectedTagIds.value.length > 0) {
      books = books.filter((b) =>
        selectedTagIds.value.every((tagId) =>
          store.state.bookTags.some((bt) => bt.bookId === b.id && bt.tagId === tagId),
        ),
      );
    }

    return books;
  });

  const lastReadBook = computed(() => {
    if (!store.state.lastReadBookId) return null;
    return bookshelfStore.books.find((b) => b.id === store.state.lastReadBookId) ?? null;
  });

  function selectGroup(groupId: string) {
    store.state.activeGroupId = groupId;
    void store.replace(store.state);
  }

  async function addGroup(name: string): Promise<ShelfGroup> {
    const newGroup: ShelfGroup = {
      id: generateId(),
      name: name.trim(),
      createdAt: Date.now(),
      enabled: true,
      order: store.state.groups.length,
    };
    store.state.groups = [...store.state.groups, newGroup];
    await store.replace(store.state);
    return newGroup;
  }

  async function removeGroup(groupId: string) {
    if (groupId === "all") return;
    store.state.groups = store.state.groups.filter((g) => g.id !== groupId);
    if (store.state.activeGroupId === groupId) {
      store.state.activeGroupId = "all";
    }
    await store.replace(store.state);
  }

  async function renameGroup(groupId: string, name: string) {
    const group = store.state.groups.find((g) => g.id === groupId);
    if (group) {
      group.name = name.trim();
      await store.replace(store.state);
    }
  }

  async function setGroupEnabled(groupId: string, enabled: boolean) {
    const group = store.state.groups.find((g) => g.id === groupId);
    if (group) {
      group.enabled = enabled;
      await store.replace(store.state);
    }
  }

  async function toggleAllGroupEnabled() {
    const enabled = !store.state.allGroupEnabled;
    store.state.allGroupEnabled = enabled;
    if (!enabled && store.state.activeGroupId === "all") {
      const firstVisible = visibleGroups.value[0];
      if (firstVisible && firstVisible.id !== "all") {
        store.state.activeGroupId = firstVisible.id;
      }
    }
    await store.replace(store.state);
  }

  async function addBookToGroup(bookId: string, groupId: string) {
    store.state.bookGroupMap = {
      ...store.state.bookGroupMap,
      [bookId]: groupId,
    };
    await store.replace(store.state);
  }

  async function removeBookFromGroup(bookId: string) {
    const newMap = { ...store.state.bookGroupMap };
    delete newMap[bookId];
    store.state.bookGroupMap = newMap;
    await store.replace(store.state);
  }

  function updateLastReadBook(bookId: string) {
    store.state.lastReadBookId = bookId;
    void store.replace(store.state);
  }

  function createTag(name: string): BookTag {
    const tag: BookTag = {
      id: generateId(),
      name: name.trim(),
      color: TAG_COLORS[store.state.tags.length % TAG_COLORS.length],
    };
    store.state.tags = [...store.state.tags, tag];
    void store.replace(store.state);
    return tag;
  }

  async function deleteTag(tagId: string) {
    store.state.tags = store.state.tags.filter((t) => t.id !== tagId);
    store.state.bookTags = store.state.bookTags.filter((bt) => bt.tagId !== tagId);
    selectedTagIds.value = selectedTagIds.value.filter((id) => id !== tagId);
    await store.replace(store.state);
  }

  async function renameTag(tagId: string, name: string) {
    const tag = store.state.tags.find((t) => t.id === tagId);
    if (tag) {
      tag.name = name.trim();
      await store.replace(store.state);
    }
  }

  async function addTagToBook(bookId: string, tagId: string) {
    if (store.state.bookTags.some((bt) => bt.bookId === bookId && bt.tagId === tagId)) {
      return;
    }
    store.state.bookTags = [...store.state.bookTags, { bookId, tagId }];
    await store.replace(store.state);
  }

  async function removeTagFromBook(bookId: string, tagId: string) {
    store.state.bookTags = store.state.bookTags.filter(
      (bt) => !(bt.bookId === bookId && bt.tagId === tagId),
    );
    await store.replace(store.state);
  }

  function getBookTags(bookId: string): BookTag[] {
    const tagIds = store.state.bookTags
      .filter((bt) => bt.bookId === bookId)
      .map((bt) => bt.tagId);
    return store.state.tags.filter((t) => tagIds.includes(t.id));
  }

  function toggleTagFilter(tagId: string) {
    if (selectedTagIds.value.includes(tagId)) {
      selectedTagIds.value = selectedTagIds.value.filter((id) => id !== tagId);
    } else {
      selectedTagIds.value = [...selectedTagIds.value, tagId];
    }
  }

  function clearTagFilter() {
    selectedTagIds.value = [];
  }

  return {
    state: store.state,
    selectedTagIds,
    groupsWithAll,
    visibleGroups,
    filteredBooks,
    lastReadBook,
    selectGroup,
    addGroup,
    removeGroup,
    renameGroup,
    setGroupEnabled,
    toggleAllGroupEnabled,
    addBookToGroup,
    removeBookFromGroup,
    updateLastReadBook,
    createTag,
    deleteTag,
    renameTag,
    addTagToBook,
    removeTagFromBook,
    getBookTags,
    toggleTagFilter,
    clearTagFilter,
  };
});