<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted } from "vue";
import { RefreshCw, CheckCheck, BellRing, ChevronRight } from "lucide-vue-next";
import { useUpdateFeedStore } from "@/stores/updateFeed";
import { useChapterUpdateChecker } from "@/composables/useChapterUpdateChecker";
import { useNavigationStore, useBookshelfStore } from "@/stores";
import AppPageHeader from "@/components/layout/AppPageHeader.vue";
import AppEmpty from "@/components/base/AppEmpty.vue";
import AppCard from "@/components/base/AppCard.vue";
import BookCoverImg from "@/components/BookCoverImg.vue";

const updateFeedStore = useUpdateFeedStore();
const navigationStore = useNavigationStore();
const bookshelfStore = useBookshelfStore();
const { checkAllUpdates, isCheckingAll } = useChapterUpdateChecker();
const { unreadCount } = storeToRefs(updateFeedStore);

const sortedEvents = computed(() =>
  [...updateFeedStore.events].sort((a, b) => b.detectedAt - a.detectedAt),
);

const hasUnread = computed(() => unreadCount.value > 0);

onMounted(() => {
  bookshelfStore.ensureLoaded().catch(() => {});
});

function handleOpenBook(bookId: string) {
  navigationStore.setActiveView("bookshelf");
}

function handleCheckUpdates() {
  checkAllUpdates().catch(() => {});
}

function handleMarkAllRead() {
  updateFeedStore.markAllRead();
}

function formatTime(ts: number): string {
  return updateFeedStore.formatRelativeTime(ts);
}

function chapterNamesPreview(names: string[]): string {
  if (names.length === 0) return "";
  const preview = names.slice(0, 3).join("、");
  return names.length > 3 ? `${preview} ...` : preview;
}
</script>

<template>
  <div class="uf-v">
    <AppPageHeader title="更新通知" :divider="true">
      <template #subtitle>书籍章节更新记录与通知</template>
      <template #actions>
        <n-button
          size="small"
          quaternary
          :loading="isCheckingAll"
          @click="handleCheckUpdates"
        >
          <template #icon>
            <RefreshCw :size="16" />
          </template>
          检查更新
        </n-button>
        <n-button
          v-if="hasUnread"
          size="small"
          quaternary
          @click="handleMarkAllRead"
        >
          <template #icon>
            <CheckCheck :size="16" />
          </template>
          全部已读
        </n-button>
      </template>
    </AppPageHeader>

    <div class="uf-v__list app-scrollbar">
      <template v-if="sortedEvents.length > 0">
        <AppCard
          v-for="event in sortedEvents"
          :key="event.id"
          class="uf-v__card"
          :class="{ 'uf-v__card--unread': !event.isRead }"
          @click="handleOpenBook(event.bookId)"
        >
          <div class="uf-v__card-inner">
            <div class="uf-v__cover">
              <BookCoverImg
                :src="event.coverUrl || undefined"
                :alt="event.bookName"
              />
            </div>
            <div class="uf-v__info">
              <div class="uf-v__book-name">{{ event.bookName }}</div>
              <div class="uf-v__chapter-count">新增 {{ event.newChapterCount }} 章</div>
              <div v-if="event.chapterNames.length > 0" class="uf-v__chapter-names">
                {{ chapterNamesPreview(event.chapterNames) }}
              </div>
              <div class="uf-v__time">{{ formatTime(event.detectedAt) }}</div>
            </div>
            <div class="uf-v__arrow">
              <div v-if="!event.isRead" class="uf-v__dot" />
              <ChevronRight :size="18" class="uf-v__arrow-icon" />
            </div>
          </div>
        </AppCard>
      </template>

      <AppEmpty
        v-else
        title="暂无更新"
        desc="去书架看看正在阅读的书籍吧，更新会出现在这里。"
      >
        <template #action>
          <n-button size="small" :loading="isCheckingAll" @click="handleCheckUpdates">
            <template #icon>
              <RefreshCw :size="14" />
            </template>
            检查更新
          </n-button>
        </template>
      </AppEmpty>
    </div>
  </div>
</template>

<style scoped>
.uf-v {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-page, var(--color-bg));
}

.uf-v__list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.uf-v__card {
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-standard);
}

.uf-v__card:hover {
  background: var(--color-hover);
}

.uf-v__card--unread {
  border-left: 3px solid var(--color-accent);
}

.uf-v__card-inner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1) 0;
}

.uf-v__cover {
  width: 48px;
  height: 64px;
  flex-shrink: 0;
  border-radius: var(--radius-1);
  overflow: hidden;
  background: var(--color-surface-variant);
}

.uf-v__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.uf-v__book-name {
  font-size: var(--fs-15);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.uf-v__chapter-count {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--color-accent);
}

.uf-v__chapter-names {
  font-size: var(--fs-12);
  color: var(--color-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.uf-v__time {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
}

.uf-v__arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
}

.uf-v__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
}

.uf-v__arrow-icon {
  flex-shrink: 0;
}
</style>