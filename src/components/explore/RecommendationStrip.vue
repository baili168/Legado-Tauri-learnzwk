<script setup lang="ts">
import { Sparkles } from "lucide-vue-next";
import { onMounted, computed } from "vue";
import type { BookItem } from "@/stores";
import { useRecommendation, type RecommendedBook } from "@/composables/useRecommendation";
import BookCoverImg from "../BookCoverImg.vue";

const emit = defineEmits<{
  (e: "select", book: BookItem, fileName: string): void;
}>();

const { recommendedBooks, isLoading, getRecommendations } = useRecommendation();

const showSection = computed(() => {
  if (isLoading.value) return true;
  return recommendedBooks.value.length > 0 || recommendedBooks.value.length === 0;
});

const showLoading = computed(() => isLoading.value && recommendedBooks.value.length === 0);
const showEmpty = computed(() => !isLoading.value && recommendedBooks.value.length === 0);
const showBooks = computed(() => recommendedBooks.value.length > 0);

function handleSelect(item: RecommendedBook) {
  emit("select", item.book, item.fileName);
}

onMounted(() => {
  getRecommendations();
});
</script>

<template>
  <section v-if="showSection" class="rec-strip">
    <div class="rec-strip__header">
      <span class="rec-strip__title">
        <Sparkles :size="16" class="rec-strip__icon" />
        为你推荐
      </span>
    </div>

    <div v-if="showLoading" class="rec-strip__row">
      <div v-for="i in 3" :key="i" class="rec-card rec-card--skeleton">
        <div class="rec-card__cover-skel" />
        <div class="rec-card__title-skel" />
        <div class="rec-card__tag-skel" />
      </div>
    </div>

    <div v-else-if="showEmpty" class="rec-strip__empty">
      <span class="rec-strip__empty-text">阅读更多书籍后获得个性化推荐</span>
    </div>

    <div v-else-if="showBooks" class="rec-strip__row app-scrollbar-proxy--hidden">
      <div
        v-for="(item, idx) in recommendedBooks"
        :key="item.book.bookUrl || idx"
        class="rec-card"
        role="button"
        tabindex="0"
        @click="handleSelect(item)"
        @keydown.enter.prevent="handleSelect(item)"
        @keydown.space.prevent="handleSelect(item)"
      >
        <div class="rec-card__cover">
          <BookCoverImg
            :src="item.book.coverUrl"
            :alt="item.book.name"
            :base-url="item.book.bookUrl"
          />
        </div>
        <span class="rec-card__title" :title="item.book.name || '未知书名'">
          {{ item.book.name || "未知书名" }}
        </span>
        <span v-if="item.book.kind" class="rec-card__tag">{{ item.book.kind }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rec-strip {
  flex-shrink: 0;
  padding: 0 var(--space-6) 8px;
}

.rec-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 6px;
}

.rec-strip__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.rec-strip__icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.rec-strip__row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}

.rec-strip__row::-webkit-scrollbar {
  display: none;
}

.rec-strip__empty {
  padding: 20px 0;
  text-align: center;
}

.rec-strip__empty-text {
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

.rec-card {
  flex-shrink: 0;
  width: 100px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  scroll-snap-align: start;
  border-radius: var(--radius-2);
  transition: opacity var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .rec-card:hover {
    opacity: 0.85;
  }
}

.rec-card__cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-2);
  overflow: hidden;
  background: var(--color-hover);
}

.rec-card__title {
  font-size: var(--fs-12);
  font-weight: var(--fw-medium);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.rec-card__tag {
  font-size: var(--fs-10);
  color: var(--color-text-muted);
  background: var(--color-hover);
  padding: 1px 6px;
  border-radius: var(--radius-1);
  align-self: flex-start;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes rec-skel-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.7; }
}

.rec-card--skeleton {
  cursor: default;
  pointer-events: none;
}

.rec-card__cover-skel {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-2);
  background: var(--color-hover);
  animation: rec-skel-pulse 1.5s ease-in-out infinite;
}

.rec-card__title-skel {
  width: 75%;
  height: 12px;
  border-radius: var(--radius-1);
  background: var(--color-hover);
  animation: rec-skel-pulse 1.5s ease-in-out infinite;
}

.rec-card__tag-skel {
  width: 50%;
  height: 14px;
  border-radius: var(--radius-1);
  background: var(--color-hover);
  animation: rec-skel-pulse 1.5s ease-in-out infinite;
}

@media (pointer: coarse), (max-width: 640px) {
  .rec-strip {
    padding: 0 var(--space-4) 8px;
  }
}
</style>