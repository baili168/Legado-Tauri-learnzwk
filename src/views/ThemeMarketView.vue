<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NSpin, useMessage } from "naive-ui";
import {
  Store,
  Star,
  Download,
  CheckCircle2,
  Play,
  Share2,
} from "lucide-vue-next";
import { useThemeMarket, type ThemeItem, type ThemeCategory } from "@/composables/useThemeMarket";

const message = useMessage();
const {
  ALL_CATEGORIES,
  selectedCategory,
  loading,
  filteredThemes,
  fetchThemes,
  filterByCategory,
  handleImportTheme,
  isImported,
  handleApplyTheme,
  exportThemeForShare,
} = useThemeMarket();

const importedStatus = ref<Record<string, boolean>>({});
const applyingId = ref<string | null>(null);

onMounted(async () => {
  await fetchThemes();
  importedStatus.value = {};
});

function formatCount(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  return n.toLocaleString();
}

function renderStars(rating: number): number[] {
  const full = Math.floor(rating);
  const stars: number[] = [];
  for (let i = 0; i < 5; i++) {
    stars.push(i < full ? 1 : 0);
  }
  return stars;
}

function onImport(item: ThemeItem) {
  const ok = handleImportTheme(item);
  if (ok) {
    importedStatus.value = { ...importedStatus.value, [item.id]: true };
    message.success(`"${item.name}" 已导入并应用`);
  } else {
    message.error("导入失败，请重试");
  }
}

function onApply(item: ThemeItem) {
  applyingId.value = item.id;
  const ok = handleApplyTheme(item);
  applyingId.value = null;
  if (ok) {
    message.success(`已应用 "${item.name}"`);
  } else {
    message.error("应用失败，请重试");
  }
}

async function onShare(item: ThemeItem) {
  const ok = await exportThemeForShare(item.themeData);
  if (ok) {
    message.success("主题 JSON 已复制到剪贴板");
  } else {
    message.error("复制失败");
  }
}
</script>

<template>
  <div class="theme-market-view">
    <div class="theme-market__header">
      <div class="theme-market__title-row">
        <Store :size="22" :stroke-width="1.75" class="theme-market__title-icon" />
        <h2 class="theme-market__title">主题市场</h2>
      </div>
      <p class="theme-market__subtitle">发现和导入社区精选阅读主题</p>
    </div>

    <div class="theme-market__chips">
      <button
        v-for="cat in ALL_CATEGORIES"
        :key="cat"
        class="theme-market__chip"
        :class="{ 'theme-market__chip--active': selectedCategory === cat }"
        @click="filterByCategory(cat as ThemeCategory)"
      >
        {{ cat }}
      </button>
    </div>

    <div v-if="loading" class="theme-market__loading">
      <n-spin size="medium" />
    </div>

    <div v-else class="theme-market__grid">
      <div
        v-for="item in filteredThemes"
        :key="item.id"
        class="theme-card"
      >
        <div class="theme-card__preview">
          <div
            class="theme-card__preview-bg"
            :style="{ backgroundColor: item.themeData.backgroundColor }"
          >
            <div class="theme-card__color-strip">
              <span
                v-for="(color, ci) in item.previewColors"
                :key="ci"
                class="theme-card__color-dot"
                :style="{ backgroundColor: color }"
              />
            </div>
            <div class="theme-card__preview-text" :style="{ color: item.themeData.textColor }">
              <span class="theme-card__preview-line" />
              <span class="theme-card__preview-line theme-card__preview-line--short" />
              <span class="theme-card__preview-line theme-card__preview-line--mid" />
            </div>
          </div>
        </div>

        <div class="theme-card__body">
          <div class="theme-card__info">
            <span class="theme-card__name">{{ item.name }}</span>
            <span class="theme-card__author">{{ item.author }}</span>
            <span class="theme-card__desc">{{ item.description }}</span>
          </div>

          <div class="theme-card__meta">
            <div class="theme-card__rating">
              <Star
                v-for="(s, si) in renderStars(item.rating)"
                :key="si"
                :size="12"
                :fill="s ? 'currentColor' : 'none'"
                :stroke-width="s ? 0 : 1.5"
                class="theme-card__star"
                :class="{ 'theme-card__star--filled': s }"
              />
              <span class="theme-card__rating-num">{{ item.rating }}</span>
            </div>
            <span class="theme-card__downloads">
              <Download :size="12" :stroke-width="1.5" />
              {{ formatCount(item.downloadCount) }}
            </span>
          </div>

          <div class="theme-card__categories">
            <span
              v-for="cat in item.categories"
              :key="cat"
              class="theme-card__tag"
            >{{ cat }}</span>
          </div>
        </div>

        <div class="theme-card__actions">
          <template v-if="isImported(item.id) || importedStatus[item.id]">
            <span class="theme-card__imported-badge">
              <CheckCircle2 :size="14" :stroke-width="2" />
              已导入
            </span>
            <n-button
              size="tiny"
              secondary
              :loading="applyingId === item.id"
              @click="onApply(item)"
            >
              <template #icon>
                <Play :size="13" :stroke-width="2" />
              </template>
              应用
            </n-button>
          </template>
          <n-button
            v-else
            size="tiny"
            type="primary"
            @click="onImport(item)"
          >
            <template #icon>
              <Download :size="13" :stroke-width="2" />
            </template>
            导入
          </n-button>
          <n-button
            size="tiny"
            quaternary
            @click="onShare(item)"
          >
            <template #icon>
              <Share2 :size="13" :stroke-width="1.75" />
            </template>
          </n-button>
        </div>
      </div>
    </div>

    <div
      v-if="!loading && filteredThemes.length === 0"
      class="theme-market__empty"
    >
      <Store :size="40" :stroke-width="1.25" class="theme-market__empty-icon" />
      <p>暂无该分类的主题</p>
    </div>
  </div>
</template>

<style scoped>
.theme-market-view {
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}

.theme-market__header {
  margin-bottom: 16px;
}

.theme-market__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-market__title-icon {
  color: var(--color-accent, #818cf8);
  flex-shrink: 0;
}

.theme-market__title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.theme-market__subtitle {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #a1a1aa);
  margin: 4px 0 0;
}

.theme-market__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.theme-market__chip {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--color-border, #3f3f46);
  background: var(--color-surface-elevated, #27272a);
  color: var(--color-text-soft, #a1a1aa);
  font-size: 0.8125rem;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}

.theme-market__chip:hover {
  border-color: var(--color-accent, #818cf8);
  color: var(--color-accent, #818cf8);
}

.theme-market__chip--active {
  background: var(--color-accent, #818cf8);
  border-color: var(--color-accent, #818cf8);
  color: #fff;
}

.theme-market__loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.theme-market__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--color-card-bg, #27272a);
  border: 1px solid var(--color-card-border, #3f3f46);
  overflow: hidden;
  transition: border-color 0.2s;
}

.theme-card:hover {
  border-color: var(--color-accent, #818cf8);
}

.theme-card__preview {
  position: relative;
  height: 88px;
  overflow: hidden;
}

.theme-card__preview-bg {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px;
}

.theme-card__color-strip {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.theme-card__color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.theme-card__preview-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 2px;
}

.theme-card__preview-line {
  display: block;
  height: 3px;
  border-radius: 1.5px;
  background: currentColor;
  opacity: 0.25;
  width: 80%;
}

.theme-card__preview-line--short {
  width: 55%;
}

.theme-card__preview-line--mid {
  width: 68%;
}

.theme-card__body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.theme-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-card__name {
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.3;
}

.theme-card__author {
  font-size: 0.6875rem;
  color: var(--color-text-muted, #a1a1aa);
}

.theme-card__desc {
  font-size: 0.6875rem;
  color: var(--color-text-soft, #71717a);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.theme-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.theme-card__rating {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #eab308;
}

.theme-card__star--filled {
  color: #eab308;
}

.theme-card__star:not(.theme-card__star--filled) {
  color: var(--color-text-muted, #71717a);
}

.theme-card__rating-num {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-soft, #a1a1aa);
  margin-left: 3px;
}

.theme-card__downloads {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6875rem;
  color: var(--color-text-muted, #71717a);
}

.theme-card__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.theme-card__tag {
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--color-surface-elevated, #1a1a1a);
  font-size: 0.625rem;
  color: var(--color-text-soft, #71717a);
  border: 1px solid var(--color-border, #3f3f46);
}

.theme-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--color-border, #3f3f46);
}

.theme-card__imported-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  color: #22c55e;
  white-space: nowrap;
  margin-right: auto;
}

.theme-market__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  color: var(--color-text-muted, #71717a);
  font-size: 0.875rem;
}

.theme-market__empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
}

@media (min-width: 768px) {
  .theme-market__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .theme-market__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>