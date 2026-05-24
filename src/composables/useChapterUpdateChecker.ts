import { useBookshelfStore, useScriptBridgeStore } from "@/stores";
import { useUpdateFeedStore } from "@/stores/updateFeed";
import { useNotification } from "@/composables/useNotification";
import { ref } from "vue";

const RATE_LIMIT_MS = 5 * 60 * 1000;
const lastCheckTimestamps = new Map<string, number>();

const isCheckingAll = ref(false);

function isRateLimited(bookId: string): boolean {
  const lastCheck = lastCheckTimestamps.get(bookId);
  if (lastCheck && Date.now() - lastCheck < RATE_LIMIT_MS) {
    return true;
  }
  return false;
}

function setLastCheck(bookId: string) {
  lastCheckTimestamps.set(bookId, Date.now());
}

async function checkSingleBook(bookId: string): Promise<void> {
  if (isRateLimited(bookId)) {
    return;
  }

  const bookshelfStore = useBookshelfStore();
  const scriptBridgeStore = useScriptBridgeStore();
  const updateFeedStore = useUpdateFeedStore();

  await bookshelfStore.ensureLoaded();
  const book = bookshelfStore.books.find((b) => b.id === bookId);
  if (!book) {
    return;
  }

  if (book.readChapterIndex < 0) {
    return;
  }

  setLastCheck(bookId);

  try {
    const bookInfo = (await scriptBridgeStore.runBookInfo(
      book.fileName,
      book.bookUrl,
    )) as { tocUrl?: string };

    const tocUrl = bookInfo.tocUrl ?? book.bookUrl;

    const raw = await scriptBridgeStore.runChapterList(book.fileName, tocUrl);
    const fetchedChapters = (
      raw as Array<{ name: string; url: string; group?: string }>
    ).map((ch, index) => ({
      index,
      name: ch.name,
      url: ch.url,
      group: ch.group,
    }));

    let cachedChapters: Array<{ index: number; name: string; url: string }> = [];
    try {
      cachedChapters = await bookshelfStore.getChapters(bookId);
    } catch {
      // no cached chapters yet
    }

    const newChapters = detectNewChapters(cachedChapters, fetchedChapters);

    if (newChapters.length > 0) {
      const coverUrl = book.coverUrl ?? "";
      updateFeedStore.addEvent({
        bookId: book.id,
        bookName: book.name,
        coverUrl,
        newChapterCount: newChapters.length,
        chapterNames: newChapters.map((ch) => ch.name).slice(0, 10),
      });

      // Save updated chapters
      await bookshelfStore.saveChapters(bookId, fetchedChapters);

      // Also update totalChapters if different
      if (book.totalChapters !== fetchedChapters.length) {
        await bookshelfStore.patchBook(bookId, {
          totalChapters: fetchedChapters.length,
          lastChapter: fetchedChapters[fetchedChapters.length - 1]?.name ?? book.lastChapter,
        });
      }

      // System notification
      trySendNotification(book.name, newChapters.length, newChapters.map((ch) => ch.name));
    }
  } catch {
    // silently fail for individual book checks
  }
}

function detectNewChapters(
  cached: Array<{ index: number; name: string; url: string }>,
  fetched: Array<{ index: number; name: string; url: string }>,
): Array<{ index: number; name: string; url: string }> {
  if (cached.length === 0) {
    return [];
  }

  if (fetched.length <= cached.length) {
    return [];
  }

  const cachedUrlSet = new Set(cached.map((ch) => ch.url));
  const cachedNameSet = new Set(cached.map((ch) => ch.name));

  return fetched.filter(
    (ch) => !cachedUrlSet.has(ch.url) && !cachedNameSet.has(ch.name),
  );
}

async function checkAllUpdates(): Promise<void> {
  if (isCheckingAll.value) {
    return;
  }

  isCheckingAll.value = true;

  try {
    const bookshelfStore = useBookshelfStore();
    await bookshelfStore.ensureLoaded();

    const readingBooks = bookshelfStore.books.filter(
      (b) => b.readChapterIndex >= 0 && b.totalChapters > 0,
    );

    for (const book of readingBooks) {
      if (isRateLimited(book.id)) {
        continue;
      }
      await checkSingleBook(book.id).catch(() => {});
    }
  } finally {
    isCheckingAll.value = false;
  }
}

function trySendNotification(
  bookName: string,
  count: number,
  chapterNames: string[],
) {
  const { sendReminder, permissionGranted } = useNotification();
  if (!permissionGranted.value) {
    return;
  }

  const previewChapters = chapterNames.slice(0, 3).join("、");
  const body =
    chapterNames.length > 3
      ? `${previewChapters} 等${count}章`
      : previewChapters;

  sendReminder(
    `《${bookName}》更新`,
    `新增 ${count} 章：${body}`,
  );
}

export function useChapterUpdateChecker() {
  return {
    isCheckingAll,
    checkAllUpdates,
    checkSingleBook,
  };
}