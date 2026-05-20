<script setup lang="ts">
import type { StyleValue } from 'vue';
import { useAndroidLifecycle } from '@/composables/useAndroidLifecycle';
import { useReaderViewStore } from '@/features/reader/stores/readerView';
import { useReaderSessionStore } from '@/features/reader/stores/readerSession';
import { storeToRefs } from 'pinia';

defineProps<{
  styleValue: StyleValue;
  skinPresetId?: string;
}>();

const { onPause, onResume, onDestroy, isForeground } = useAndroidLifecycle();

const readerViewStore = useReaderViewStore();
const readerSessionStore = useReaderSessionStore();
const { currentShelfId, bookName, readingChapterIndex } = storeToRefs(readerViewStore);
const { currentPageIndex, currentScrollRatio } = storeToRefs(readerSessionStore);

function getPageOffset(): number {
  if (currentPageIndex.value >= 0) return currentPageIndex.value;
  if (currentScrollRatio.value >= 0) return currentScrollRatio.value;
  return 0;
}

function saveReadingProgress() {
  const bookId = currentShelfId.value;
  if (!bookId) return;

  const progressData = {
    chapterIndex: readingChapterIndex.value,
    pageOffset: getPageOffset(),
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(`legado-reading-progress-${bookId}`, JSON.stringify(progressData));

    localStorage.setItem(
      'legado-last-reading',
      JSON.stringify({
        bookId,
        bookName: bookName.value,
        chapterIndex: readingChapterIndex.value,
        pageOffset: getPageOffset(),
        currentTab: 'reader',
        timestamp: Date.now(),
      }),
    );
  } catch {
    // storage full or unavailable
  }
}

onPause(async () => {
  saveReadingProgress();
});

onResume(() => {
  // 不恢复阅读位置，由应用启动时统一恢复
});

onDestroy(() => {
  saveReadingProgress();
});
</script>

<template>
  <div class="reader-modal" :style="styleValue" :data-reader-skin="skinPresetId || ''">
    <slot />
  </div>
</template>
