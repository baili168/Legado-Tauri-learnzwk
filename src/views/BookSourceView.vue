<script setup lang="ts">
import { useMessage } from "naive-ui";
import { storeToRefs } from "pinia";
import { ref, computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, watch } from "vue";
import type {
  DebugSourceTabInstance,
  InstalledSourcesTabInstance,
  OnlineSourcesTabInstance,
} from "@/types";
import { eventEmit, eventListen } from "@/composables/useEventBus";
import { useMobileHorizontalSwipe } from "@/composables/useMobileHorizontalSwipe";
import { useBookSourceStore } from "@/stores";
import AiSourceTab from "../components/booksource/AiSourceTab.vue";
import DebugSourceTab from "../components/booksource/DebugSourceTab.vue";
import InstalledSourcesTab from "../components/booksource/InstalledSourcesTab.vue";
import OnlineSourcesTab from "../components/booksource/OnlineSourcesTab.vue";
import TestSourcesTab from "../components/booksource/TestSourcesTab.vue";
import AppPageHeader from "../components/layout/AppPageHeader.vue";
import MobileToolbarMenu from "../components/layout/MobileToolbarMenu.vue";
import { type BookSourceMeta, getBookSourceDir } from "../composables/useBookSource";
import { useSourceMarket } from "../composables/useSourceMarket";
const SmartSourceDetector = defineAsyncComponent(
  () => import("../components/booksource/SmartSourceDetector.vue"),
);

const message = useMessage();
const bookSourceStore = useBookSourceStore();

// sources / loading / streamingLoaded 直接响应式引用 store，流式批次到达时自动更新
const { sources, loading, sourceDirs: storeDirs, streamingLoaded } = storeToRefs(bookSourceStore);

type BookSourceTab = "installed" | "smart" | "online" | "debug" | "test" | "ai" | "market";
const BOOK_SOURCE_TABS: BookSourceTab[] = ["installed", "smart", "online", "debug", "test", "ai", "market"];

const activeTab = ref<BookSourceTab>("installed");

// ---- 共享状态 ----
const sourceDir = ref("");
const sourceDirs = computed(() => storeDirs.value);

// ---- 书源集市 ----
const {
  marketSourcesWithState,
  importing: marketImporting,
  importProgress: marketImportProgress,
  importSource: doMarketImport,
  batchImport: doMarketBatchImport,
} = useSourceMarket(sources);

const marketSearchQuery = ref("");
const marketCategoryFilter = ref<string | null>(null);
const marketLanguageFilter = ref<string | null>(null);
const marketSelectedIds = ref<Set<string>>(new Set());

const marketCategories = computed(() => {
  const cats = new Set<string>();
  for (const ms of marketSourcesWithState.value) {
    if (ms.item.category) cats.add(ms.item.category);
  }
  return [...cats].sort();
});

const marketLanguages = computed(() => {
  const langs = new Set<string>();
  for (const ms of marketSourcesWithState.value) {
    if (ms.item.language) langs.add(ms.item.language);
  }
  return [...langs].sort();
});

const filteredMarketSources = computed(() => {
  return marketSourcesWithState.value.filter((ms) => {
    const q = marketSearchQuery.value.trim().toLowerCase();
    if (q && !ms.item.name.toLowerCase().includes(q) && !ms.item.author.toLowerCase().includes(q)) {
      return false;
    }
    if (marketCategoryFilter.value && ms.item.category !== marketCategoryFilter.value) {
      return false;
    }
    if (marketLanguageFilter.value && ms.item.language !== marketLanguageFilter.value) {
      return false;
    }
    return true;
  });
});

const marketAllSelected = computed(() => {
  const filtered = filteredMarketSources.value;
  if (filtered.length === 0) return false;
  return filtered.every((ms) => marketSelectedIds.value.has(ms.item.id));
});

function toggleMarketSelectAll() {
  if (marketAllSelected.value) {
    marketSelectedIds.value = new Set();
  } else {
    marketSelectedIds.value = new Set(filteredMarketSources.value.map((ms) => ms.item.id));
  }
}

function toggleMarketSelect(id: string) {
  const next = new Set(marketSelectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  marketSelectedIds.value = next;
}

async function handleMarketImport(id: string) {
  const ok = await doMarketImport(id);
  if (ok) {
    await loadSources();
  }
}

async function handleMarketBatchImport() {
  const ids = [...marketSelectedIds.value];
  if (ids.length === 0) {
    message.warning("请先选择要导入的书源");
    return;
  }
  await doMarketBatchImport(ids);
  marketSelectedIds.value = new Set();
  await loadSources();
}

let _loadSourcesInFlight = false;

async function loadSources() {
  if (_loadSourcesInFlight) {
    return;
  }
  _loadSourcesInFlight = true;
  try {
    // bookSourceStore.loadSources() 内部流式追加 sources，目录信息单独取
    const [, dir] = await Promise.all([bookSourceStore.loadSources(), getBookSourceDir()]);
    sourceDir.value = dir;
    // sourceDirs 通过 storeToRefs 已响应式绑定，无需手动同步
  } catch (e: unknown) {
    message.error(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    _loadSourcesInFlight = false;
  }
}

// ---- 子组件 refs ----
const installedRef = ref<InstalledSourcesTabInstance | null>(null);
const onlineRef = ref<OnlineSourcesTabInstance | null>(null);
const debugRef = ref<DebugSourceTabInstance | null>(null);
const pendingDebugSource = ref<BookSourceMeta | null>(null);

function onNavigateTab(tab: string) {
  if (BOOK_SOURCE_TABS.includes(tab as BookSourceTab)) {
    activeTab.value = tab as BookSourceTab;
  }
}

function onSelectDebugSource(source: BookSourceMeta) {
  pendingDebugSource.value = source;
  activeTab.value = "debug";
}

watch(
  () => [activeTab.value, debugRef.value, pendingDebugSource.value] as const,
  async ([tab, debugInstance, source]) => {
    if (tab !== "debug" || !debugInstance || !source) {
      return;
    }
    await nextTick();
    debugInstance.setDebugSource(source);
    pendingDebugSource.value = null;
  },
  { flush: "post" },
);

function switchActiveTab(direction: "prev" | "next") {
  const idx = BOOK_SOURCE_TABS.indexOf(activeTab.value);
  if (idx < 0) {
    return;
  }
  const nextIdx = direction === "next" ? idx + 1 : idx - 1;
  if (nextIdx < 0 || nextIdx >= BOOK_SOURCE_TABS.length) {
    return;
  }
  activeTab.value = BOOK_SOURCE_TABS[nextIdx];
}

const {
  onSwipePointerDown,
  onSwipePointerMove,
  onSwipePointerUp,
  onSwipePointerCancel,
  onSwipeClickCapture,
} = useMobileHorizontalSwipe({
  onSwipeLeft: () => switchActiveTab("next"),
  onSwipeRight: () => switchActiveTab("prev"),
});

// ── 移动端工具栏菜单 ──────────────────────────────────────────────────
const newSourceOptions = [
  { label: "小说书源", key: "new-novel" },
  { label: "视频书源", key: "new-video" },
];

const mobileMenuOptions = computed(() => [
  { label: "目录管理", key: "dir" },
  { label: "导入本地", key: "import-file" },
  { label: "导入在线", key: "import-online" },
  { label: "导出书源", key: "export-file" },
  { label: "新建书源", key: "new", children: newSourceOptions },
  { label: "全部重载", key: "reload", disabled: loading.value },
]);

const onlineMenuOptions = computed(() => [
  { label: "获取列表", key: "fetch-online" },
  { label: "添加仓库", key: "add-online-repo" },
  { label: "移除仓库", key: "remove-online-repo" },
  { label: "重新检查", key: "recheck-online" },
  { label: "批量安装", key: "install-all-online" },
  { label: "批量更新", key: "update-all-online" },
  { label: "批量强制更新", key: "force-update-all-online" },
]);

const onlineBatchOptions = [
  { label: "重新检查", key: "recheck-online" },
  { label: "批量安装", key: "install-all-online" },
  { label: "批量更新", key: "update-all-online" },
  { label: "批量强制更新", key: "force-update-all-online" },
];

function handleMobileMenuSelect(key: string) {
  switch (key) {
    case "dir":
      installedRef.value?.openDirManager();
      break;
    case "import-file":
      installedRef.value?.importFromFile();
      break;
    case "import-online":
      installedRef.value?.importFromUrl();
      break;
    case "export-file":
      void installedRef.value?.exportSources();
      break;
    case "new":
    case "new-novel":
      installedRef.value?.openEditor(undefined, "novel");
      break;
    case "new-video":
      installedRef.value?.openEditor(undefined, "video");
      break;
    case "reload":
      installedRef.value?.reloadAllSources();
      break;
  }
}

function handleOnlineMenuSelect(key: string) {
  switch (key) {
    case "fetch-online":
      void onlineRef.value?.fetchOnlineSources();
      break;
    case "add-online-repo":
      onlineRef.value?.openAddRepo();
      break;
    case "remove-online-repo":
      onlineRef.value?.removeActiveRepo();
      break;
    case "recheck-online":
      void onlineRef.value?.recheckInstalledSources();
      break;
    case "install-all-online":
      void onlineRef.value?.installAll();
      break;
    case "update-all-online":
      void onlineRef.value?.updateAll();
      break;
    case "force-update-all-online":
      onlineRef.value?.confirmForceUpdateAll();
      break;
  }
}

async function handleForceReload() {
  if (installedRef.value) {
    await installedRef.value.reloadAllSources();
    return;
  }
  await loadSources();
  await eventEmit("app:booksource-reload", { scope: "all" });
}

// ── 初始化 ──
let unlistenFileChange: (() => void) | null = null;
let unlistenViewReload: (() => void) | null = null;
let _bsvMounted = false;

onMounted(async () => {
  _bsvMounted = true;
  await loadSources();

  // 若加载期间组件已卸载，不再注册监听
  if (!_bsvMounted) {
    return;
  }

  const unlisten = await eventListen<{ fileName?: string; reason?: string }>(
    "booksource:changed",
    async (event) => {
      const { fileName, reason } = event.payload ?? {};
      if (fileName) {
        // toggle 操作仅修改 enabled 字段，前端已就地更新，无需全量重载（避免列表滚动到顶部）
        if (reason === "toggle") {
          return;
        }
        bookSourceStore.invalidateCapability(fileName);
        installedRef.value?.handleFileChange(fileName);
      } else {
        // 批量变更（如同步后），使所有能力缓存失效
        bookSourceStore.invalidateAllCapabilities();
      }
      await loadSources();
    },
  );

  // listen 返回前组件可能已卸载（快速切换视图），直接清理
  if (!_bsvMounted) {
    unlisten();
    return;
  }
  unlistenFileChange = unlisten;

  const unlistenReload = await eventListen<{ view?: string }>("app:view-reload", async (event) => {
    if (event.payload?.view === "booksource") {
      await handleForceReload();
    }
  });

  if (!_bsvMounted) {
    unlistenReload();
    return;
  }
  unlistenViewReload = unlistenReload;
});

onUnmounted(() => {
  _bsvMounted = false;
  unlistenFileChange?.();
  unlistenFileChange = null;
  unlistenViewReload?.();
  unlistenViewReload = null;
});
</script>

<template>
  <div class="booksource-view">
    <AppPageHeader title="书源管理" :divider="true" :hide-subtitle-on-mobile="true">
      <template #subtitle> 管理已安装书源、浏览在线仓库 </template>
      <template #actions>
        <template v-if="activeTab === 'installed'">
          <MobileToolbarMenu :options="mobileMenuOptions" @select="handleMobileMenuSelect">
            <n-button
              size="small"
              quaternary
              title="管理外部书源目录"
              @click="installedRef?.openDirManager()"
              >目录</n-button
            >
            <n-button size="small" quaternary @click="installedRef?.importFromFile()"
              >导入本地</n-button
            >
            <n-button size="small" quaternary @click="installedRef?.importFromUrl()"
              >导入在线</n-button
            >
            <n-dropdown
              trigger="click"
              :options="newSourceOptions"
              @select="handleMobileMenuSelect"
            >
              <n-button size="small" type="primary">新建书源</n-button>
            </n-dropdown>
            <n-button size="small" :loading="loading" @click="installedRef?.reloadAllSources()"
              >全部重载</n-button
            >
          </MobileToolbarMenu>
        </template>
        <template v-else-if="activeTab === 'online'">
          <MobileToolbarMenu :options="onlineMenuOptions" @select="handleOnlineMenuSelect">
            <n-button size="small" type="primary" @click="onlineRef?.fetchOnlineSources()"
              >获取列表</n-button
            >
            <n-button size="small" quaternary @click="onlineRef?.openAddRepo()">添加仓库</n-button>
            <n-button size="small" quaternary @click="onlineRef?.removeActiveRepo()">移除</n-button>
            <n-dropdown
              trigger="click"
              :options="onlineBatchOptions"
              @select="handleOnlineMenuSelect"
            >
              <n-button size="small" quaternary>批量操作</n-button>
            </n-dropdown>
          </MobileToolbarMenu>
        </template>
        <template v-else-if="activeTab === 'market'">
          <n-button
            size="small"
            type="primary"
            :loading="marketImporting"
            :disabled="marketSelectedIds.size === 0"
            @click="handleMarketBatchImport"
          >
            导入选中 ({{ marketSelectedIds.size }})
          </n-button>
          <n-button size="small" quaternary @click="toggleMarketSelectAll">
            {{ marketAllSelected ? "取消全选" : "全选" }}
          </n-button>
        </template>
      </template>
    </AppPageHeader>

    <!-- 流式加载进度提示（仅在后台持续加载时显示） -->
    <div v-if="loading && streamingLoaded > 0" class="bv-streaming-bar">
      <n-progress
        type="line"
        :percentage="100"
        :height="2"
        :border-radius="0"
        :fill-border-radius="0"
        status="info"
        :indicator-placement="'inside'"
        :show-indicator="false"
        processing
      />
      <span class="bv-streaming-bar__text">正在加载书源 · 已加载 {{ streamingLoaded }} 条</span>
    </div>

    <!-- 主 Tabs -->
    <n-tabs
      v-model:value="activeTab"
      type="line"
      animated
      class="bv-tabs"
      @pointerdown="onSwipePointerDown"
      @pointermove="onSwipePointerMove"
      @pointerup="onSwipePointerUp"
      @pointercancel="onSwipePointerCancel"
      @click.capture="onSwipeClickCapture"
    >
      <n-tab-pane name="installed" tab="已安装书源">
        <InstalledSourcesTab
          ref="installedRef"
          :sources="sources"
          :source-dir="sourceDir"
          :source-dirs="sourceDirs"
          :loading="loading"
          @reload="loadSources"
          @navigate-tab="onNavigateTab"
          @select-debug-source="onSelectDebugSource"
        />
      </n-tab-pane>

      <n-tab-pane name="smart" tab="智能添加" display-directive="show">
        <div class="bv-pane bv-pane--fill">
          <SmartSourceDetector :sources="sources" @reload="loadSources" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="online" tab="在线书源">
        <OnlineSourcesTab
          ref="onlineRef"
          :sources="sources"
          :active="activeTab === 'online'"
          @reload="loadSources"
        />
      </n-tab-pane>

      <n-tab-pane name="debug" tab="调试书源">
        <DebugSourceTab ref="debugRef" :sources="sources" />
      </n-tab-pane>

      <n-tab-pane name="test" tab="书源测试">
        <TestSourcesTab :sources="sources" />
      </n-tab-pane>

      <n-tab-pane name="ai" tab="AI 写书源" display-directive="show">
        <div class="bv-pane bv-pane--fill">
          <AiSourceTab :sources="sources" @reload="loadSources" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="market" tab="书源集市">
        <div class="bv-pane bv-pane--fill">
          <div class="market-toolbar">
            <n-input
              v-model:value="marketSearchQuery"
              placeholder="搜索书源名称或作者..."
              clearable
              size="small"
              class="market-search"
            >
              <template #prefix>
                <span class="market-search-icon">🔍</span>
              </template>
            </n-input>
            <n-select
              v-model:value="marketCategoryFilter"
              :options="
                [{ label: '全部分类', value: null }].concat(
                  marketCategories.map((c) => ({ label: c === 'novel' ? '小说' : c === 'comic' ? '漫画' : c === 'audio' ? '有声' : c, value: c })),
                )
              "
              size="small"
              class="market-filter"
              placeholder="分类"
            />
            <n-select
              v-model:value="marketLanguageFilter"
              :options="
                [{ label: '全部语言', value: null }].concat(
                  marketLanguages.map((l) => ({ label: l, value: l })),
                )
              "
              size="small"
              class="market-filter"
              placeholder="语言"
            />
          </div>

          <div v-if="marketImporting" class="market-import-bar">
            <n-progress
              type="line"
              :percentage="100"
              :height="2"
              :border-radius="0"
              :fill-border-radius="0"
              status="info"
              :indicator-placement="'inside'"
              :show-indicator="false"
              processing
            />
            <span class="market-import-bar__text">{{ marketImportProgress }}</span>
          </div>

          <div class="market-list">
            <div
              v-for="ms in filteredMarketSources"
              :key="ms.item.id"
              class="market-card"
              :class="{
                'market-card--installed': ms.installed,
                'market-card--selected': marketSelectedIds.has(ms.item.id),
              }"
            >
              <div class="market-card__checkbox">
                <n-checkbox
                  :checked="marketSelectedIds.has(ms.item.id)"
                  :disabled="ms.installed && ms.versionDiff !== 'upgrade'"
                  @update:checked="toggleMarketSelect(ms.item.id)"
                />
              </div>

              <div class="market-card__body">
                <div class="market-card__row">
                  <span class="market-card__name">{{ ms.item.name }}</span>
                  <span
                    class="market-card__status"
                    :class="{
                      'market-card__status--ok': ms.item.status === 'ok',
                      'market-card__status--slow': ms.item.status === 'slow',
                      'market-card__status--broken': ms.item.status === 'broken',
                    }"
                    :title="
                      ms.item.status === 'ok'
                        ? '正常'
                        : ms.item.status === 'slow'
                          ? '较慢'
                          : '失效'
                    "
                  />
                  <n-tag
                    size="tiny"
                    :bordered="false"
                    :type="
                      ms.item.category === 'novel'
                        ? 'info'
                        : ms.item.category === 'comic'
                          ? 'success'
                          : 'warning'
                    "
                    class="market-card__category"
                  >
                    {{
                      ms.item.category === "novel"
                        ? "小说"
                        : ms.item.category === "comic"
                          ? "漫画"
                          : ms.item.category
                    }}
                  </n-tag>
                </div>

                <div class="market-card__row market-card__row--meta">
                  <span class="market-card__author">{{ ms.item.author }}</span>
                  <span class="market-card__rating">
                    <span
                      v-for="s in 5"
                      :key="s"
                      class="market-card__star"
                      :class="{ 'market-card__star--fill': s <= Math.round(ms.item.rating) }"
                      >★</span
                    >
                    {{ ms.item.rating.toFixed(1) }}
                  </span>
                  <n-tag size="tiny" :bordered="false" class="market-card__version"
                    >v{{ ms.item.version }}</n-tag
                  >
                </div>

                <div class="market-card__row market-card__row--tags">
                  <n-tag
                    v-for="t in ms.item.tags.slice(0, 3)"
                    :key="t"
                    size="tiny"
                    :bordered="false"
                    class="market-card__tag"
                    >{{ t }}</n-tag
                  >
                  <span class="market-card__tested">最近测试: {{ ms.item.lastTested }}</span>
                </div>

                <div v-if="ms.item.description" class="market-card__desc">
                  {{ ms.item.description }}
                </div>
              </div>

              <div class="market-card__actions">
                <n-tag
                  v-if="ms.installed"
                  size="tiny"
                  type="success"
                  :bordered="false"
                  class="market-card__installed-badge"
                  >已安装</n-tag
                >
                <template v-if="ms.installed && ms.versionDiff === 'upgrade'">
                  <n-button
                    size="tiny"
                    type="primary"
                    quaternary
                    :disabled="marketImporting"
                    :title="`本地 ${ms.localVersion} → 集市 ${ms.item.version}`"
                    @click="handleMarketImport(ms.item.id)"
                  >
                    更新
                  </n-button>
                </template>
                <template v-else-if="ms.installed && ms.versionDiff === 'same'">
                  <n-tag size="tiny" :bordered="false" class="market-card__uptodate-tag"
                    >已是最新</n-tag
                  >
                </template>
                <template v-else-if="!ms.installed">
                  <n-button
                    size="tiny"
                    type="primary"
                    :disabled="marketImporting"
                    @click="handleMarketImport(ms.item.id)"
                  >
                    安装
                  </n-button>
                </template>
              </div>
            </div>

            <div v-if="filteredMarketSources.length === 0" class="market-empty">
              <span>未找到匹配的书源</span>
            </div>
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
/* ---- 外层 ---- */
.booksource-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* background: var(--color-bg-page); */
}

.bv-header__dir {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  opacity: 0.6;
}

.bv-header__dir--clickable {
  cursor: pointer;
  border-radius: var(--radius-1);
  padding: 2px 8px;
  transition:
    background var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    opacity var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .bv-header__dir--clickable:hover {
    background: var(--color-hover);
    color: var(--color-text-soft);
    opacity: 1;
  }
}

.bv-header__dir-path {
  font-size: var(--fs-11);
  font-family: "Cascadia Code", "Consolas", monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

/* ---- 流式加载进度条 ---- */
.bv-streaming-bar {
  flex-shrink: 0;
  position: relative;
  height: 20px;
}

.bv-streaming-bar__text {
  position: absolute;
  right: 12px;
  top: 2px;
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  pointer-events: none;
}

/* ---- Tabs ---- */
.bv-tabs {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 24px;
}

:deep(.n-tabs-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.n-tabs-nav) {
  padding-top: 4px;
}

:deep(.n-tabs-tab) {
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  color: var(--color-text-muted) !important;
  padding: 8px 2px;
  transition: color var(--dur-fast) var(--ease-standard);
}

:deep(.n-tabs-tab--active) {
  font-weight: var(--fw-semibold);
  color: var(--color-text) !important;
}

:deep(.n-tabs-tab:hover:not(.n-tabs-tab--active)) {
  color: var(--color-text-soft) !important;
}

:deep(.n-tabs-bar) {
  background: var(--color-accent) !important;
  height: 2px;
}

:deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

:deep(.n-tab-pane) {
  flex: 1;
  min-height: 0;
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* ---- 通用 Pane ---- */
.bv-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 12px;
}

.bv-pane--fill {
  padding-top: 0;
  overflow: hidden;
}

.bv-pane :deep(.n-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bv-pane :deep(.n-spin-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── 移动端适配 ── */
@media (pointer: coarse), (max-width: 640px) {
  .bv-tabs {
    min-height: 0;
    padding: 0 12px;
    touch-action: pan-y;
  }

  :deep(.n-tabs-tab) {
    padding: 6px 2px !important;
    font-size: var(--fs-13) !important;
  }
}

/* ── 书源集市 ── */
.market-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 10px;
  flex-shrink: 0;
}

.market-search {
  flex: 1;
  min-width: 0;
  max-width: 320px;
}

.market-search-icon {
  font-size: 12px;
  line-height: 1;
}

.market-filter {
  width: 110px;
  flex-shrink: 0;
}

.market-import-bar {
  flex-shrink: 0;
  position: relative;
  height: 20px;
}

.market-import-bar__text {
  position: absolute;
  right: 12px;
  top: 2px;
  font-size: var(--fs-11);
  color: var(--color-text-muted);
}

.market-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 16px;
}

.market-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.market-card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.market-card--installed {
  opacity: 0.88;
  border-left: 3px solid color-mix(in srgb, var(--color-success, #18a058) 50%, transparent);
}

.market-card--selected {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 6%, var(--color-surface-raised));
}

.market-card__checkbox {
  flex-shrink: 0;
  padding-top: 3px;
}

.market-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.market-card__row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.market-card__row--meta {
  gap: 8px;
}

.market-card__row--tags {
  gap: 4px;
}

.market-card__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.market-card__status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.market-card__status--ok {
  background: var(--color-success, #18a058);
}

.market-card__status--slow {
  background: var(--color-warning, #f0a020);
}

.market-card__status--broken {
  background: var(--color-danger, #d03050);
}

.market-card__category {
  font-size: 0.625rem !important;
  text-transform: capitalize;
}

.market-card__author {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  opacity: 0.7;
}

.market-card__rating {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 2px;
}

.market-card__star {
  color: color-mix(in srgb, var(--color-border) 60%, transparent);
  font-size: 0.75rem;
  line-height: 1;
}

.market-card__star--fill {
  color: var(--color-warning, #f0a020);
}

.market-card__version {
  font-size: 0.625rem !important;
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
}

.market-card__tag {
  font-size: 0.6rem !important;
  height: 15px !important;
  line-height: 13px !important;
  padding: 0 5px !important;
  --n-color: color-mix(in srgb, var(--color-border) 80%, transparent) !important;
  --n-text-color: var(--color-text-muted) !important;
  opacity: 0.65;
}

.market-card__tested {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  opacity: 0.5;
  margin-left: auto;
}

.market-card__desc {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  opacity: 0.75;
  padding-top: 2px;
}

.market-card__actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding-top: 2px;
}

.market-card__installed-badge {
  font-size: 0.625rem !important;
}

.market-card__uptodate-tag {
  font-size: 0.625rem !important;
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
}

.market-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  color: var(--color-text-muted);
  font-size: var(--fs-14);
}

@media (pointer: coarse), (max-width: 640px) {
  .market-toolbar {
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 0 8px;
  }

  .market-search {
    max-width: none;
    width: 100%;
    flex-basis: 100%;
  }

  .market-filter {
    width: auto;
    flex: 1;
    min-width: 80px;
  }

  .market-card {
    padding: 8px 10px;
    gap: 8px;
  }

  .market-card__actions {
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }
}
</style>
