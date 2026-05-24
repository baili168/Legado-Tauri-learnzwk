<script setup lang="ts">
import {
  RefreshCw,
  Trophy,
  Bookmark,
  Sparkles,
  TrendingUp,
  ChevronDown,
} from "lucide-vue-next";
import { computed, onMounted, ref, watch } from "vue";
import type { BookItem } from "@/stores";
import type { BookSourceMeta } from "@/composables/useBookSource";
import { useRankings } from "@/composables/useRankings";
import type { RankingType } from "@/composables/useRankings";
import BookCoverImg from "@/components/BookCoverImg.vue";
import AppEmpty from "@/components/base/AppEmpty.vue";
import AppSkeleton from "@/components/base/AppSkeleton.vue";

const props = defineProps<{
  sources: BookSourceMeta[];
}>();

const emit = defineEmits<{
  (e: "select", book: BookItem): void;
}>();

const { rankingBooks, loading, error, fetchRankings } = useRankings();

const RANKING_TABS: { type: RankingType; label: string; icon: typeof Trophy }[] = [
  { type: "hot", label: "综合热门", icon: TrendingUp },
  { type: "collected", label: "收藏榜", icon: Bookmark },
  { type: "new", label: "新书榜", icon: Sparkles },
  { type: "updated", label: "更新榜", icon: RefreshCw },
];

const activeRankingType = ref<RankingType>("hot");
const selectedSourceIndex = ref(0);
const refreshing = ref(false);

const currentSource = computed(() => props.sources[selectedSourceIndex.value]);

const rankColor = (rank: number): string => {
  if (rank === 1) return "#f59e0b";
  if (rank === 2) return "#9ca3af";
  if (rank === 3) return "#d97706";
  return "var(--color-text-muted)";
};

const rankBg = (rank: number): string => {
  if (rank === 1) return "linear-gradient(135deg, #fef3c7, #fde68a)";
  if (rank === 2) return "linear-gradient(135deg, #f3f4f6, #e5e7eb)";
  if (rank === 3) return "linear-gradient(135deg, #fef3c7, #fdba74)";
  return "transparent";
};

async function loadRankings() {
  const src = currentSource.value;
  if (!src) {
    return;
  }
  await fetchRankings(src.fileName, activeRankingType.value);
}

async function handleRefresh() {
  refreshing.value = true;
  try {
    await loadRankings();
  } finally {
    setTimeout(() => {
      refreshing.value = false;
    }, 600);
  }
}

function handleSourceChange(index: number) {
  selectedSourceIndex.value = index;
}

watch(activeRankingType, () => {
  void loadRankings();
});

watch(selectedSourceIndex, () => {
  void loadRankings();
});

onMounted(() => {
  if (props.sources.length > 0) {
    void loadRankings();
  }
});
</script>

<template>
  <div class="tr">
    <div class="tr__toolbar">
      <div class="tr__tabs">
        <button
          v-for="tab in RANKING_TABS"
          :key="tab.type"
          class="tr__tab-btn"
          :class="{ 'tr__tab-btn--active': activeRankingType === tab.type }"
          @click="activeRankingType = tab.type"
        >
          <component :is="tab.icon" :size="14" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <div class="tr__actions">
        <n-dropdown
          trigger="click"
          :options="
            sources.map((s, i) => ({
              label: s.name,
              key: String(i),
            }))
          "
          :value="String(selectedSourceIndex)"
          @select="(key: string) => handleSourceChange(Number(key))"
        >
          <n-button size="small" quaternary>
            <span class="tr__source-label">{{ currentSource?.name ?? '选择书源' }}</span>
            <template #icon>
              <ChevronDown :size="12" />
            </template>
          </n-button>
        </n-dropdown>

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" quaternary :loading="refreshing" @click="handleRefresh">
              <template #icon>
                <RefreshCw :size="14" />
              </template>
            </n-button>
          </template>
          刷新榜单
        </n-tooltip>
      </div>
    </div>

    <div class="tr__content app-scrollbar">
      <div v-if="loading && rankingBooks.length === 0" class="tr__skeleton">
        <AppSkeleton
          v-for="idx in 10"
          :key="idx"
          variant="rect"
          height="64px"
          class="tr__skeleton-item"
        />
      </div>

      <div v-else-if="error" class="tr__error">{{ error }}</div>

      <div v-else-if="rankingBooks.length === 0 && !loading" class="tr__empty-wrap">
        <AppEmpty title="暂无榜单数据" desc="该书源下没有找到对应排行榜分类" />
      </div>

      <div v-else class="tr__list">
        <div
          v-for="(book, index) in rankingBooks"
          :key="book.bookUrl || index"
          class="tr__item"
          role="button"
          tabindex="0"
          @click="emit('select', book)"
          @keydown.enter.prevent="emit('select', book)"
          @keydown.space.prevent="emit('select', book)"
        >
          <div class="tr__rank" :style="{ color: rankColor(index + 1), background: rankBg(index + 1) }">
            <Trophy v-if="index < 3" :size="12" class="tr__rank-icon" />
            <span v-else class="tr__rank-num">{{ index + 1 }}</span>
          </div>

          <div class="tr__cover">
            <BookCoverImg
              :src="book.coverUrl"
              :alt="book.name"
              :base-url="book.bookUrl"
            />
          </div>

          <div class="tr__info">
            <span class="tr__name" :title="book.name">{{ book.name || "未知书名" }}</span>
            <span class="tr__author" :title="book.author">{{ book.author || "佚名" }}</span>
            <span v-if="book.intro" class="tr__intro" :title="book.intro">{{ book.intro }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tr {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tr__toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0 8px;
  border-bottom: 1px solid var(--color-border);
}

.tr__tabs {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.tr__tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: var(--fs-12);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
  white-space: nowrap;
}

@media (hover: hover) and (pointer: fine) {
  .tr__tab-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
}

.tr__tab-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.tr__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tr__source-label {
  font-size: var(--fs-12);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-muted);
}

.tr__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.tr__skeleton {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
}

.tr__skeleton-item {
  border-radius: var(--radius-2);
}

.tr__error {
  padding: var(--space-3) 0;
  font-size: var(--fs-13);
  color: var(--color-danger);
}

.tr__empty-wrap {
  padding: var(--space-6) 0;
}

.tr__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
}

.tr__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-2);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .tr__item:hover {
    border-color: var(--color-accent);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
  }
}

.tr__rank {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--fw-bold);
  font-size: var(--fs-13);
}

.tr__rank-icon {
  flex-shrink: 0;
}

.tr__rank-num {
  font-size: var(--fs-12);
}

.tr__cover {
  width: 32px;
  height: 44px;
  border-radius: var(--radius-1);
  flex-shrink: 0;
  overflow: hidden;
}

.tr__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  justify-content: center;
}

.tr__name {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.tr__author {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.tr__intro {
  font-size: var(--fs-10);
  color: var(--color-text-muted);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
</style>