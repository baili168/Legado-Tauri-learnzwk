<script setup lang="ts">
import { Search, X, BookOpen, Loader2 } from "lucide-vue-next";
import { ref, computed } from "vue";
import type { BookSearchGroup, SearchResult } from "@/composables/useGlobalSearch";
import { useGlobalSearch } from "@/composables/useGlobalSearch";
import BookCoverImg from "@/components/BookCoverImg.vue";

defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", v: boolean): void;
  (e: "navigate", result: SearchResult): void;
}>();

const { search, searching, progress } = useGlobalSearch();

const query = ref("");
const groups = ref<BookSearchGroup[]>([]);
const hasSearched = ref(false);

const progressText = computed(() => {
  if (!searching.value) {
    return "";
  }
  return `搜索 ${progress.value.done}/${progress.value.total} 本书中...`;
});

const emptyText = computed(() => {
  if (searching.value) {
    return "";
  }
  if (!hasSearched.value) {
    return "输入关键词以搜索所有缓存章节";
  }
  return "未找到匹配结果";
});

async function doSearch() {
  const kw = query.value.trim();
  if (!kw) {
    return;
  }
  hasSearched.value = true;
  groups.value = await search(kw);
}

function highlightExcerpt(text: string, kw: string): string {
  if (!kw) {
    return text;
  }
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), '<mark class="gsm-highlight">$1</mark>');
}

function onResultClick(result: SearchResult) {
  emit("navigate", result);
}

function close() {
  query.value = "";
  groups.value = [];
  hasSearched.value = false;
  emit("update:show", false);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    void doSearch();
  }
}
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :close-on-esc="true"
    preset="card"
    title="全文搜索"
    :style="{ maxWidth: '640px', width: '92vw', maxHeight: '85vh' }"
    :segmented="{ content: true }"
    @update:show="(v) => !v && close()"
    @after-leave="close"
  >
    <div class="gsm-input-row">
      <n-input
        v-model:value="query"
        placeholder="输入关键词搜索所有缓存的章节内容..."
        clearable
        autofocus
        :disabled="searching"
        @keydown="onKeydown"
      >
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-button type="primary" size="small" :loading="searching" @click="doSearch">
        搜索
      </n-button>
    </div>

    <div v-if="searching" class="gsm-status">
      <Loader2 :size="16" class="gsm-spinner" />
      <span>{{ progressText }}</span>
    </div>

    <div class="gsm-results app-scrollbar">
      <template v-if="groups.length > 0">
        <div v-for="group in groups" :key="group.bookId" class="gsm-book-group">
          <div class="gsm-book-header">
            <BookCoverImg
              :src="group.coverUrl"
              :alt="group.bookTitle"
              class="gsm-book-cover"
            />
            <div class="gsm-book-info">
              <div class="gsm-book-title">{{ group.bookTitle }}</div>
              <div class="gsm-book-author">{{ group.bookAuthor || '佚名' }}</div>
              <div class="gsm-book-matches">{{ group.matchCount }} 处匹配</div>
            </div>
          </div>

          <div class="gsm-chapter-list">
            <div
              v-for="(result, idx) in group.results"
              :key="idx"
              class="gsm-chapter-item"
              role="button"
              tabindex="0"
              @click="onResultClick(result)"
              @keydown.enter.prevent="onResultClick(result)"
            >
              <div class="gsm-chapter-title">
                <BookOpen :size="13" />
                <span>{{ result.chapterTitle }}</span>
              </div>
              <div
                class="gsm-excerpt"
                v-html="highlightExcerpt(result.matchedText, query.trim())"
              />
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="!searching" class="gsm-empty">
        {{ emptyText }}
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.gsm-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.gsm-input-row :deep(.n-input) {
  flex: 1;
}

.gsm-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0 8px;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

.gsm-spinner {
  animation: gsm-spin 1s linear infinite;
}

@keyframes gsm-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.gsm-results {
  max-height: 55vh;
  overflow-y: auto;
  margin-top: 12px;
}

.gsm-book-group {
  margin-bottom: 16px;
}

.gsm-book-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 6px;
}

.gsm-book-cover {
  width: 40px;
  height: 52px;
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-fill-secondary);
}

.gsm-book-info {
  min-width: 0;
}

.gsm-book-title {
  font-size: var(--fs-15);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gsm-book-author {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  margin-top: 1px;
}

.gsm-book-matches {
  font-size: var(--fs-11);
  color: var(--color-accent);
  margin-top: 2px;
}

.gsm-chapter-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gsm-chapter-item {
  padding: 8px 12px;
  border-radius: var(--radius-1);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-standard);
  border-left: 3px solid transparent;
}

@media (hover: hover) and (pointer: fine) {
  .gsm-chapter-item:hover {
    background: var(--color-fill-secondary);
    border-left-color: var(--color-accent);
  }
}

.gsm-chapter-item:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
  border-radius: var(--radius-1);
}

.gsm-chapter-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--color-text);
  margin-bottom: 4px;
}

.gsm-excerpt {
  font-size: var(--fs-13);
  color: var(--color-text-soft);
  line-height: var(--lh-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.gsm-highlight) {
  background: #fde047;
  color: #1a1a2e;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: var(--fw-semibold);
}

.gsm-empty {
  text-align: center;
  padding: 32px 0;
  font-size: var(--fs-14);
  color: var(--color-text-muted);
}
</style>