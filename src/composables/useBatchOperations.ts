import type { ShelfBook } from "@/composables/useBookshelf";
import { useBookshelfStore, useShelfGroupsStore } from "@/stores";

export function useBatchOperations() {
  const bookshelfStore = useBookshelfStore();
  const shelfGroupsStore = useShelfGroupsStore();

  function selectAll(books: ShelfBook[], selectedBookIds: Set<string>): Set<string> {
    return new Set(books.map((b) => b.id));
  }

  function clearSelection(): Set<string> {
    return new Set();
  }

  async function batchAddTags(bookIds: string[], tagIds: string[]) {
    for (const bookId of bookIds) {
      for (const tagId of tagIds) {
        await shelfGroupsStore.addTagToBook(bookId, tagId);
      }
    }
  }

  async function batchRemoveTags(bookIds: string[], tagIds: string[]) {
    for (const bookId of bookIds) {
      for (const tagId of tagIds) {
        await shelfGroupsStore.removeTagFromBook(bookId, tagId);
      }
    }
  }

  async function batchMoveGroup(bookIds: string[], groupId: string) {
    for (const bookId of bookIds) {
      await shelfGroupsStore.addBookToGroup(bookId, groupId);
    }
  }

  async function batchMarkRead(bookIds: string[]) {
    for (const id of bookIds) {
      const book = bookshelfStore.books.find((b) => b.id === id);
      if (book && book.totalChapters > 0) {
        await bookshelfStore.patchBook(id, {
          readChapterIndex: book.totalChapters - 1,
          readChapterUrl: book.readChapterUrl,
          lastReadAt: Date.now(),
        });
      }
    }
  }

  async function batchMarkUnread(bookIds: string[]) {
    for (const id of bookIds) {
      await bookshelfStore.patchBook(id, {
        readChapterIndex: -1,
        readChapterUrl: undefined,
        readPageIndex: -1,
        readScrollRatio: -1,
        readPlaybackTime: -1,
      });
    }
  }

  async function batchDelete(bookIds: string[]) {
    for (const id of bookIds) {
      await bookshelfStore.removeFromShelf(id);
    }
  }

  return {
    selectAll,
    clearSelection,
    batchAddTags,
    batchRemoveTags,
    batchMoveGroup,
    batchMarkRead,
    batchMarkUnread,
    batchDelete,
  };
}