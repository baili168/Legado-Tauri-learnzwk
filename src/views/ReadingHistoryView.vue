<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, Clock, BookOpen, Calendar } from 'lucide-vue-next'
import { useReadingRecordsStore } from '@/stores/readingRecords'
import { useBackStackStore } from '@/stores'
import ReadingTimeline from '@/components/reading/ReadingTimeline.vue'

const store = useReadingRecordsStore()
const selectedDate = ref('')
const backStackStore = useBackStackStore()

const dailyRecord = computed(() => {
  if (!selectedDate.value) return null
  return store.getDailyRecord(selectedDate.value)
})

const readingDays = computed(() => {
  const dates = new Set<string>()
  store.sessions.forEach(s => {
    const d = new Date(s.startTime)
    dates.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
  })
  return dates.size
})

function onSelectDay(date: string) {
  selectedDate.value = date
}

function formatDuration(secs: number): string {
  if (secs <= 0) return '0分钟'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}小时${m}分钟`
}

function formatDurationShort(secs: number): string {
  if (secs <= 0) return '0m'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m}m`
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-')
  return `${parts[1]}月${parts[2]}日`
}

function formatChapterRange(session: { startChapter: number; endChapter: number }): string {
  if (session.startChapter === session.endChapter) return `第${session.startChapter + 1}章`
  return `第${session.startChapter + 1}-${session.endChapter + 1}章`
}

function onBack() {
  if (backStackStore.onKeyBack()) return
  window.history.back()
}
</script>

<template>
  <div class="rhv-root">
    <header class="rhv-header">
      <button class="rhv-back focusable" @click="onBack">
        <ChevronLeft :size="18" />
        <span>返回</span>
      </button>
      <span class="rhv-title">阅读记录</span>
      <div class="rhv-placeholder" aria-hidden="true" />
    </header>

    <div class="rhv-content app-scrollbar">
      <div class="rhv-stats-row">
        <div class="rhv-stat-card">
          <div class="rhv-stat-icon"><Clock :size="18" /></div>
          <div class="rhv-stat-body">
            <div class="rhv-stat-value">{{ formatDurationShort(store.totalReadingTime) }}</div>
            <div class="rhv-stat-label">总时长</div>
          </div>
        </div>
        <div class="rhv-stat-card">
          <div class="rhv-stat-icon"><BookOpen :size="18" /></div>
          <div class="rhv-stat-body">
            <div class="rhv-stat-value">{{ store.totalPagesRead }}</div>
            <div class="rhv-stat-label">总页数</div>
          </div>
        </div>
        <div class="rhv-stat-card">
          <div class="rhv-stat-icon"><Calendar :size="18" /></div>
          <div class="rhv-stat-body">
            <div class="rhv-stat-value">{{ readingDays }}</div>
            <div class="rhv-stat-label">阅读天数</div>
          </div>
        </div>
      </div>

      <div class="rhv-section">
        <div class="rhv-section-title">阅读热力图</div>
        <ReadingTimeline @select-day="onSelectDay" />
      </div>

      <div v-if="dailyRecord" class="rhv-section">
        <div class="rhv-section-title">{{ formatDate(dailyRecord.date) }}</div>
        <div class="rhv-daily-summary">
          <span class="rhv-daily-stat">共读 {{ formatDuration(dailyRecord.totalDuration) }}</span>
          <span class="rhv-daily-divider">·</span>
          <span class="rhv-daily-stat">{{ dailyRecord.totalPages }} 页</span>
        </div>

        <div v-if="dailyRecord.sessions.length === 0" class="rhv-empty">
          当天无阅读记录
        </div>

        <div v-else class="rhv-session-list">
          <div
            v-for="session in dailyRecord.sessions"
            :key="session.id"
            class="rhv-session-item"
          >
            <div class="rhv-session-cover">
              <img
                v-if="session.coverUrl"
                :src="session.coverUrl"
                class="rhv-cover-img"
                alt=""
              />
              <div v-else class="rhv-cover-placeholder">
                <BookOpen :size="16" />
              </div>
            </div>
            <div class="rhv-session-info">
              <div class="rhv-session-name">{{ session.bookName }}</div>
              <div class="rhv-session-meta">
                <span>{{ formatChapterRange(session) }}</span>
                <span class="rhv-session-divider">·</span>
                <span>{{ formatDurationShort(session.duration) }}</span>
                <span class="rhv-session-divider">·</span>
                <span>{{ session.pagesRead }}页</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="rhv-section rhv-section--hint">
        <div class="rhv-hint-text">点击热力图方块查看当天阅读详情</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rhv-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-bg-page, var(--color-bg));
}

.rhv-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(72px, auto) 1fr minmax(72px, auto);
  align-items: center;
  gap: var(--space-2);
  min-height: 52px;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.rhv-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 40px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-accent);
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  justify-self: start;
  cursor: pointer;
}

.rhv-title {
  min-width: 0;
  text-align: center;
  font-size: var(--fs-15);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rhv-placeholder {
  min-height: 40px;
}

.rhv-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.rhv-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.rhv-stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3);
  border-radius: var(--radius-2);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
}

.rhv-stat-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.rhv-stat-body {
  min-width: 0;
}

.rhv-stat-value {
  font-size: var(--fs-15);
  font-weight: var(--fw-bold);
  color: var(--color-text);
  line-height: 1.2;
}

.rhv-stat-label {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.rhv-section {
  display: flex;
  flex-direction: column;
}

.rhv-section-title {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  margin-bottom: var(--space-3);
}

.rhv-daily-summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.rhv-daily-stat {
  font-size: var(--fs-13);
  color: var(--color-text-soft);
}

.rhv-daily-divider {
  color: var(--color-text-muted);
}

.rhv-empty {
  font-size: var(--fs-13);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-6) 0;
}

.rhv-session-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.rhv-session-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-1);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
}

.rhv-session-cover {
  width: 40px;
  height: 56px;
  border-radius: var(--radius-1);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface-soft, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.rhv-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rhv-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.rhv-session-info {
  flex: 1;
  min-width: 0;
}

.rhv-session-name {
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rhv-session-meta {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.rhv-session-divider {
  color: var(--color-text-muted);
}

.rhv-section--hint {
  align-items: center;
  padding: var(--space-6) 0;
}

.rhv-hint-text {
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}
</style>