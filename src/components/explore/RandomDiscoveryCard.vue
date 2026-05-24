<script setup lang="ts">
import { Shuffle, BookmarkPlus, X, BookOpen } from "lucide-vue-next";
import { ref } from "vue";
import { useRandomDiscovery } from "@/composables/useRandomDiscovery";
import type { BookSourceMeta } from "@/composables/useBookSource";
import BookCoverImg from "@/components/BookCoverImg.vue";
import AppSkeleton from "@/components/base/AppSkeleton.vue";
import type { BookItem } from "@/stores";

const props = defineProps<{
  sources: BookSourceMeta[];
}>();

const emit = defineEmits<{
  (e: "select", book: BookItem): void;
}>();

const { currentRandomBook, isLoading, refresh, addToBookshelf, clear } =
  useRandomDiscovery();

const showCard = ref(false);
const flipping = ref(false);
const excludeIds = ref<string[]>([]);

async function handleTrigger() {
  if (showCard.value && currentRandomBook.value) {
    return;
  }
  flipping.value = true;
  try {
    await refresh(excludeIds.value);
    showCard.value = true;
  } finally {
    setTimeout(() => {
      flipping.value = false;
    }, 350);
  }
}

async function handleRefresh() {
  if (isLoading.value) return;
  if (currentRandomBook.value) {
    excludeIds.value.push(currentRandomBook.value.book.bookUrl);
  }
  flipping.value = true;
  try {
    await refresh(excludeIds.value);
  } finally {
    setTimeout(() => {
      flipping.value = false;
    }, 350);
  }
}

function handleClose() {
  showCard.value = false;
  clear();
}

async function handleAddToShelf() {
  await addToBookshelf();
}

function handleSelect() {
  if (currentRandomBook.value) {
    emit("select", currentRandomBook.value.book);
  }
}
</script>

<template>
  <div class="rdc">
    <Transition name="rdc-fab-slide">
      <button
        v-if="!showCard"
        class="rdc__fab"
        :disabled="sources.length === 0"
        @click="handleTrigger"
      >
        <Shuffle :size="20" class="rdc__fab-icon" />
        <span class="rdc__fab-label">随机</span>
      </button>
    </Transition>

    <Transition name="rdc-card-pop">
      <div v-if="showCard" class="rdc__card" :class="{ 'rdc__card--flipping': flipping }">
        <div class="rdc__card-inner">
          <button class="rdc__close-btn" @click="handleClose">
            <X :size="14" />
          </button>

          <div
            class="rdc__cover-area"
            role="button"
            tabindex="0"
            @click="handleSelect"
            @keydown.enter.prevent="handleSelect"
            @keydown.space.prevent="handleSelect"
          >
            <BookCoverImg
              v-if="currentRandomBook"
              :src="currentRandomBook.book.coverUrl"
              :alt="currentRandomBook.book.name"
              :base-url="currentRandomBook.book.bookUrl"
            />
            <AppSkeleton v-else variant="rect" class="rdc__cover-skeleton" />
          </div>

          <div class="rdc__info" v-if="currentRandomBook">
            <span class="rdc__book-name" :title="currentRandomBook.book.name">
              {{ currentRandomBook.book.name || "未知书名" }}
            </span>
            <span class="rdc__book-author">
              {{ currentRandomBook.book.author || "佚名" }}
            </span>
            <span class="rdc__book-source">
              {{ currentRandomBook.sourceName }}
              <template v-if="currentRandomBook.book.kind">
                · {{ currentRandomBook.book.kind }}
              </template>
            </span>
          </div>

          <div class="rdc__actions">
            <n-button
              size="small"
              quaternary
              :loading="isLoading"
              @click="handleRefresh"
            >
              <template #icon><Shuffle :size="14" /></template>
              换一个
            </n-button>
            <n-button
              size="small"
              secondary
              type="primary"
              @click="handleAddToShelf"
            >
              <template #icon><BookmarkPlus :size="14" /></template>
              加入书架
            </n-button>
            <n-button
              size="small"
              quaternary
              @click="handleSelect"
            >
              <template #icon><BookOpen :size="14" /></template>
              详情
            </n-button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rdc {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.rdc__fab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 20px;
  background: var(--color-accent);
  color: #fff;
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition:
    transform var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard);
  white-space: nowrap;
}

@media (hover: hover) and (pointer: fine) {
  .rdc__fab:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }
}

.rdc__fab:active {
  transform: scale(0.97);
}

.rdc__fab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rdc__fab-icon {
  flex-shrink: 0;
}

.rdc__fab-label {
  flex-shrink: 0;
}

.rdc__card {
  width: 280px;
  max-width: calc(100vw - 32px);
  border-radius: var(--radius-3);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  transition:
    transform 0.35s var(--ease-standard),
    opacity 0.35s var(--ease-standard);
}

.rdc__card--flipping {
  transform: rotateY(90deg);
  opacity: 0.3;
}

.rdc__card-inner {
  position: relative;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rdc__close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px;
  border: none;
  border-radius: var(--radius-1);
  background: var(--color-hover);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-fast) var(--ease-standard);
  z-index: 1;
}

@media (hover: hover) and (pointer: fine) {
  .rdc__close-btn:hover {
    background: var(--color-border);
  }
}

.rdc__cover-area {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-2);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.rdc__cover-skeleton {
  width: 100%;
  height: 100%;
}

.rdc__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rdc__book-name {
  font-size: var(--fs-15);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rdc__book-author {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rdc__book-source {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rdc__actions {
  display: flex;
  gap: 6px;
  justify-content: flex-start;
}

.rdc-fab-slide-enter-active,
.rdc-fab-slide-leave-active {
  transition:
    transform 0.25s var(--ease-standard),
    opacity 0.25s var(--ease-standard);
}

.rdc-fab-slide-enter-from,
.rdc-fab-slide-leave-to {
  transform: scale(0.8) translateY(10px);
  opacity: 0;
}

.rdc-card-pop-enter-active,
.rdc-card-pop-leave-active {
  transition:
    transform 0.3s var(--ease-standard),
    opacity 0.3s var(--ease-standard);
}

.rdc-card-pop-enter-from {
  transform: scale(0.85) translateY(20px);
  opacity: 0;
}

.rdc-card-pop-leave-to {
  transform: scale(0.9) translateY(10px);
  opacity: 0;
}
</style>