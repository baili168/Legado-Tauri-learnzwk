<script setup lang="ts">
import {
  BookOpen,
  Clock,
  Activity,
  Bookmark as BookMark,
  TrendingUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from "lucide-vue-next";
import { NCard, NStatistic, NList, NListItem, NEmpty, NDivider } from "naive-ui";
import { computed, ref, watch } from "vue";
import { useReadingStatsStore, type ReadingSession } from "@/stores/readingStats";
import type { BookStats, GlobalStats, DailyHeatmapEntry } from "@/stores/readingStats";

const props = withDefaults(
  defineProps<{
    bookId?: string | null;
    bookName?: string;
  }>(),
  {
    bookId: null,
    bookName: "",
  },
);

const store = useReadingStatsStore();

const isBookMode = computed(() => !!props.bookId);

const heatmapYear = ref(new Date().getFullYear());
const heatmapMonth = ref(new Date().getMonth() + 1);

const bookStats = ref<BookStats | null>(null);
const globalStats = ref<GlobalStats | null>(null);
const recentSessions = ref<ReadingSession[]>([]);
const topBooks = ref<{ bookId: string; bookName: string; duration: number }[]>([]);
const dailyHeatmap = ref<DailyHeatmapEntry[]>([]);

function refreshData() {
  store.loadSessions();

  if (isBookMode.value && props.bookId) {
    bookStats.value = store.getBookStats(props.bookId);
    recentSessions.value = store.sessions
      .filter((s) => s.bookId === props.bookId && s.durationSecs > 0)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 20);
  } else {
    globalStats.value = store.getGlobalStats();
    dailyHeatmap.value = store.getDailyHeatmap(heatmapYear.value, heatmapMonth.value);

    const bookMap = new Map<string, { bookId: string; bookName: string; duration: number }>();
    for (const s of store.sessions) {
      const existing = bookMap.get(s.bookId);
      if (existing) {
        existing.duration += s.durationSecs;
      } else {
        bookMap.set(s.bookId, {
          bookId: s.bookId,
          bookName: s.bookName,
          duration: s.durationSecs,
        });
      }
    }
    topBooks.value = [...bookMap.values()].sort((a, b) => b.duration - a.duration).slice(0, 5);
  }
}

function formatDuration(secs: number): string {
  const totalMinutes = Math.round(secs / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

function formatDurationShort(secs: number): string {
  const totalMinutes = Math.round(secs / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[1]}月${parts[2]}日`;
}

function formatNumber(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  return String(n);
}

function getHeatmapIntensity(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

const heatmapTitle = computed(() => {
  return `${heatmapYear.value}年${heatmapMonth.value}月`;
});

const heatmapDays = computed(() => {
  const prefix = `${heatmapYear.value}-${String(heatmapMonth.value).padStart(2, "0")}-`;
  const daysInMonth = new Date(heatmapYear.value, heatmapMonth.value, 0).getDate();
  const firstDayOfWeek = new Date(heatmapYear.value, heatmapMonth.value - 1, 1).getDay();
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const cells: { date: string; day: number; minutes: number; empty: boolean }[] = [];

  for (let i = 0; i < adjustedFirstDay; i++) {
    cells.push({ date: "", day: 0, minutes: 0, empty: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${prefix}${String(d).padStart(2, "0")}`;
    const entry = dailyHeatmap.value.find((e) => e.date === date);
    cells.push({
      date,
      day: d,
      minutes: entry?.minutes ?? 0,
      empty: false,
    });
  }

  return cells;
});

function goToPrevMonth() {
  if (heatmapMonth.value === 1) {
    heatmapMonth.value = 12;
    heatmapYear.value--;
  } else {
    heatmapMonth.value--;
  }
  dailyHeatmap.value = store.getDailyHeatmap(heatmapYear.value, heatmapMonth.value);
}

function goToNextMonth() {
  if (heatmapMonth.value === 12) {
    heatmapMonth.value = 1;
    heatmapYear.value++;
  } else {
    heatmapMonth.value++;
  }
  dailyHeatmap.value = store.getDailyHeatmap(heatmapYear.value, heatmapMonth.value);
}

function getHeatmapTooltip(cell: { date: string; minutes: number }): string {
  if (!cell.date) return "";
  return `${cell.date}: ${cell.minutes}分钟`;
}

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

const hasBookData = computed(() => {
  return bookStats.value && bookStats.value.totalSessions > 0;
});

const hasGlobalData = computed(() => {
  return globalStats.value && globalStats.value.totalSessions > 0;
});

watch(
  () => [props.bookId],
  () => {
    refreshData();
  },
  { immediate: true },
);
</script>

<template>
  <div class="rsp-root">
    <!-- ==================== 单本书统计模式 ==================== -->
    <template v-if="isBookMode">
      <n-card v-if="bookStats && hasBookData" class="rsp-card" :bordered="false" size="small">
        <template #header>
          <div class="rsp-header">
            <BookOpen :size="18" class="rsp-header-icon" />
            <span class="rsp-title">{{ props.bookName || "阅读统计" }}</span>
          </div>
        </template>

        <div class="rsp-stats-grid rsp-stats-grid--4">
          <div class="rsp-stat-item">
            <n-statistic label="总阅读时长" :value="formatDuration(bookStats.totalDuration)">
              <template #prefix>
                <Clock :size="16" />
              </template>
            </n-statistic>
          </div>
          <div class="rsp-stat-item">
            <n-statistic label="阅读天数" :value="bookStats.readingDays">
              <template #prefix>
                <Activity :size="16" />
              </template>
            </n-statistic>
          </div>
          <div class="rsp-stat-item">
            <n-statistic label="总阅读字数" :value="formatNumber(bookStats.totalWords)">
              <template #prefix>
                <BookMark :size="16" />
              </template>
            </n-statistic>
          </div>
          <div class="rsp-stat-item">
            <n-statistic label="平均速度" :value="`${bookStats.avgSpeed} 字/分`">
              <template #prefix>
                <TrendingUp :size="16" />
              </template>
            </n-statistic>
          </div>
        </div>

        <n-divider />

        <div class="rsp-section-title">阅读历史</div>
        <n-list v-if="recentSessions.length > 0" class="rsp-session-list">
          <n-list-item v-for="session in recentSessions" :key="session.id">
            <div class="rsp-session-row">
              <span class="rsp-session-date">{{ formatDate(session.date) }}</span>
              <span class="rsp-session-duration">{{
                formatDurationShort(session.durationSecs)
              }}</span>
              <span class="rsp-session-words">{{ formatNumber(session.wordsRead) }} 字</span>
            </div>
          </n-list-item>
        </n-list>

        <n-empty v-if="recentSessions.length === 0" description="暂无近期阅读记录" size="small" />
      </n-card>

      <n-card v-else class="rsp-card rsp-card--empty" :bordered="false" size="small">
        <n-empty description="暂无阅读记录" size="medium">
          <template #icon>
            <BookOpen :size="40" class="rsp-empty-icon" />
          </template>
        </n-empty>
      </n-card>
    </template>

    <!-- ==================== 全局统计模式 ==================== -->
    <template v-else>
      <n-card v-if="globalStats && hasGlobalData" class="rsp-card" :bordered="false" size="small">
        <template #header>
          <div class="rsp-header">
            <BarChart3 :size="18" class="rsp-header-icon" />
            <span class="rsp-title">阅读统计总览</span>
          </div>
        </template>

        <div class="rsp-stats-grid rsp-stats-grid--5">
          <div class="rsp-stat-item">
            <n-statistic label="总阅读时长" :value="formatDuration(globalStats.totalDuration)">
              <template #prefix>
                <Clock :size="16" />
              </template>
            </n-statistic>
          </div>
          <div class="rsp-stat-item">
            <n-statistic label="阅读书籍数" :value="globalStats.totalBooks">
              <template #prefix>
                <BookOpen :size="16" />
              </template>
            </n-statistic>
          </div>
          <div class="rsp-stat-item">
            <n-statistic label="总阅读字数" :value="formatNumber(globalStats.totalWords)">
              <template #prefix>
                <BookMark :size="16" />
              </template>
            </n-statistic>
          </div>
          <div class="rsp-stat-item">
            <n-statistic label="日均阅读" :value="`${globalStats.avgDailyMinutes} 分/天`">
              <template #prefix>
                <Activity :size="16" />
              </template>
            </n-statistic>
          </div>
          <div class="rsp-stat-item">
            <n-statistic label="阅读天数" :value="globalStats.totalDays">
              <template #prefix>
                <TrendingUp :size="16" />
              </template>
            </n-statistic>
          </div>
        </div>

        <n-divider />

        <div class="rsp-section-title">月度热力图</div>
        <div class="rsp-heatmap-container">
          <div class="rsp-heatmap-header">
            <button class="rsp-heatmap-nav" @click="goToPrevMonth">
              <ChevronLeft :size="16" />
            </button>
            <span class="rsp-heatmap-month">{{ heatmapTitle }}</span>
            <button class="rsp-heatmap-nav" @click="goToNextMonth">
              <ChevronRight :size="16" />
            </button>
          </div>

          <div class="rsp-heatmap-grid-wrapper">
            <div class="rsp-heatmap-weekdays">
              <span v-for="day in weekdays" :key="day" class="rsp-heatmap-weekday">{{ day }}</span>
            </div>
            <div class="rsp-heatmap-days">
              <div
                v-for="(cell, idx) in heatmapDays"
                :key="idx"
                class="rsp-heatmap-cell"
                :class="{
                  'rsp-heatmap-cell--empty': cell.empty,
                  [`rsp-heatmap-cell--i${getHeatmapIntensity(cell.minutes)}`]: !cell.empty,
                }"
                :title="cell.empty ? '' : getHeatmapTooltip(cell)"
              >
                <span v-if="!cell.empty" class="rsp-heatmap-day">{{ cell.day }}</span>
              </div>
            </div>
          </div>

          <div class="rsp-heatmap-legend">
            <span class="rsp-legend-label">少</span>
            <div class="rsp-legend-box rsp-heatmap-cell--i0"></div>
            <div class="rsp-legend-box rsp-heatmap-cell--i1"></div>
            <div class="rsp-legend-box rsp-heatmap-cell--i2"></div>
            <div class="rsp-legend-box rsp-heatmap-cell--i3"></div>
            <div class="rsp-legend-box rsp-heatmap-cell--i4"></div>
            <span class="rsp-legend-label">多</span>
          </div>
        </div>

        <n-divider />

        <div class="rsp-section-title">最常阅读</div>
        <n-list v-if="topBooks.length > 0" class="rsp-top-list">
          <n-list-item v-for="book in topBooks" :key="book.bookId">
            <div class="rsp-top-row">
              <span class="rsp-top-name">{{ book.bookName }}</span>
              <span class="rsp-top-duration">{{ formatDurationShort(book.duration) }}</span>
            </div>
          </n-list-item>
        </n-list>

        <n-empty v-if="topBooks.length === 0" description="暂无书籍记录" size="small" />
      </n-card>

      <n-card v-else class="rsp-card rsp-card--empty" :bordered="false" size="small">
        <n-empty description="暂无阅读记录" size="medium">
          <template #icon>
            <BookOpen :size="40" class="rsp-empty-icon" />
          </template>
        </n-empty>
      </n-card>
    </template>
  </div>
</template>

<style scoped>
.rsp-root {
  width: 100%;
}

.rsp-card {
  margin-bottom: 12px;
}

.rsp-card--empty {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rsp-empty-icon {
  color: var(--color-text-muted);
  opacity: 0.4;
}

.rsp-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rsp-header-icon {
  color: var(--color-text-muted);
}

.rsp-title {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.rsp-stats-grid {
  display: grid;
  gap: 12px;
  padding: 4px 0;
}

.rsp-stats-grid--4 {
  grid-template-columns: repeat(2, 1fr);
}

.rsp-stats-grid--5 {
  grid-template-columns: repeat(2, 1fr);
}

.rsp-stat-item {
  background: var(--color-surface-soft);
  border-radius: var(--radius-md);
  padding: 12px 14px;
}

.rsp-section-title {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  margin-bottom: 10px;
}

.rsp-session-list {
  max-height: 320px;
  overflow-y: auto;
}

.rsp-session-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.rsp-session-date {
  font-size: var(--fs-12);
  color: var(--color-text);
  min-width: 60px;
}

.rsp-session-duration {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  flex: 1;
}

.rsp-session-words {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.rsp-heatmap-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rsp-heatmap-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.rsp-heatmap-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: var(--color-surface-soft);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}

.rsp-heatmap-nav:hover {
  color: var(--color-text);
  background: var(--color-border);
}

.rsp-heatmap-month {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.rsp-heatmap-grid-wrapper {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.rsp-heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  gap: 3px;
}

.rsp-heatmap-weekday {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  line-height: 28px;
  text-align: right;
  width: 20px;
}

.rsp-heatmap-days {
  display: grid;
  grid-template-columns: repeat(7, 28px);
  grid-auto-rows: 28px;
  gap: 3px;
}

.rsp-heatmap-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: var(--color-surface-soft);
  transition: transform 0.12s;
}

.rsp-heatmap-cell:not(.rsp-heatmap-cell--empty):hover {
  transform: scale(1.15);
}

.rsp-heatmap-cell--empty {
  background: transparent;
}

.rsp-heatmap-cell--i0 {
  background: var(--color-surface-soft);
}

.rsp-heatmap-cell--i1 {
  background: #bbf7d0;
}

.rsp-heatmap-cell--i2 {
  background: #86efac;
}

.rsp-heatmap-cell--i3 {
  background: #4ade80;
}

.rsp-heatmap-cell--i4 {
  background: #22c55e;
}

.rsp-heatmap-day {
  font-size: var(--fs-12);
  color: var(--color-text);
}

.rsp-heatmap-cell--i3 .rsp-heatmap-day,
.rsp-heatmap-cell--i4 .rsp-heatmap-day {
  color: #fff;
}

.rsp-heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
}

.rsp-legend-label {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.rsp-legend-box {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.rsp-legend-box.rsp-heatmap-cell--i0 {
  background: var(--color-surface-soft);
}

.rsp-legend-box.rsp-heatmap-cell--i1 {
  background: #bbf7d0;
}

.rsp-legend-box.rsp-heatmap-cell--i2 {
  background: #86efac;
}

.rsp-legend-box.rsp-heatmap-cell--i3 {
  background: #4ade80;
}

.rsp-legend-box.rsp-heatmap-cell--i4 {
  background: #22c55e;
}

.rsp-top-list {
  max-height: 260px;
  overflow-y: auto;
}

.rsp-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.rsp-top-name {
  font-size: var(--fs-13);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rsp-top-duration {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .rsp-stats-grid--4 {
    grid-template-columns: repeat(4, 1fr);
  }

  .rsp-stats-grid--5 {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
