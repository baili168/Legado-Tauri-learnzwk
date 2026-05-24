<script setup lang="ts">
import { Clock, Type, BookOpen, Flame } from "lucide-vue-next"
import { computed, onMounted, ref } from "vue"
import { useReadingStats, type ReadingStats, type DailyStat } from "@/composables/useReadingStats"

const statsRef = ref<ReadingStats>({
  totalMinutes: 0,
  totalWords: 0,
  totalBooks: 0,
  dailyStats: [],
  currentStreak: 0,
})
const weeklyStats = ref<DailyStat[]>([])

function refresh() {
  const { getStats, getWeeklyStats } = useReadingStats()
  statsRef.value = getStats()
  weeklyStats.value = getWeeklyStats()
}

onMounted(() => {
  refresh()
})

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 分钟"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours} 小时 ${mins} 分钟`
  }
  return `${mins} 分钟`
}

function formatWords(words: number): string {
  if (words >= 10000) {
    return `${(words / 10000).toFixed(1)} 万字`
  }
  return `${words.toLocaleString()} 字`
}

const maxBarMinutes = computed(() => {
  const max = Math.max(...weeklyStats.value.map((s) => s.minutesRead), 1)
  return max
})

const weekLabels = ["日", "一", "二", "三", "四", "五", "六"]

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return weekLabels[d.getDay()]
}
</script>

<template>
  <div class="rsp-root">
    <div class="rsp-header">
      <h2 class="rsp-title">阅读统计</h2>
      <button class="rsp-refresh-btn" @click="refresh">刷新</button>
    </div>

    <div class="rsp-cards">
      <div class="rsp-card">
        <div class="rsp-card-icon rsp-card-icon--time">
          <Clock :size="22" />
        </div>
        <div class="rsp-card-body">
          <span class="rsp-card-label">累计阅读时长</span>
          <span class="rsp-card-value">{{ formatMinutes(statsRef.totalMinutes) }}</span>
        </div>
      </div>

      <div class="rsp-card">
        <div class="rsp-card-icon rsp-card-icon--words">
          <Type :size="22" />
        </div>
        <div class="rsp-card-body">
          <span class="rsp-card-label">累计阅读字数</span>
          <span class="rsp-card-value">{{ formatWords(statsRef.totalWords) }}</span>
        </div>
      </div>

      <div class="rsp-card">
        <div class="rsp-card-icon rsp-card-icon--books">
          <BookOpen :size="22" />
        </div>
        <div class="rsp-card-body">
          <span class="rsp-card-label">阅读书籍数</span>
          <span class="rsp-card-value">{{ statsRef.totalBooks }} 本</span>
        </div>
      </div>
    </div>

    <div class="rsp-section">
      <h3 class="rsp-section-title">过去7天阅读分钟</h3>
      <div class="rsp-bar-chart">
        <div v-for="stat in weeklyStats" :key="stat.date" class="rsp-bar-col">
          <div class="rsp-bar-wrapper">
            <div
              class="rsp-bar"
              :style="{
                height: maxBarMinutes > 0 ? `${(stat.minutesRead / maxBarMinutes) * 100}%` : '0%',
              }"
              :class="{ 'rsp-bar--empty': stat.minutesRead === 0 }"
            >
              <span v-if="stat.minutesRead > 0" class="rsp-bar-value">
                {{ stat.minutesRead }}分
              </span>
            </div>
          </div>
          <span class="rsp-bar-label">{{ getDayLabel(stat.date) }}</span>
        </div>
      </div>
    </div>

    <div class="rsp-section">
      <div class="rsp-streak">
        <div class="rsp-streak-icon">
          <Flame :size="28" />
        </div>
        <div class="rsp-streak-body">
          <span class="rsp-streak-label">当前连续阅读</span>
          <span class="rsp-streak-value">{{ statsRef.currentStreak }} 天</span>
        </div>
      </div>
    </div>

    <div v-if="statsRef.totalMinutes === 0" class="rsp-empty">
      <p>还没有阅读记录，快去读一本书吧</p>
    </div>
  </div>
</template>

<style scoped>
.rsp-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.rsp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rsp-title {
  font-size: var(--fs-18);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  margin: 0;
}

.rsp-refresh-btn {
  padding: 4px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: var(--fs-13);
  font-family: var(--font-ui);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard);
}

.rsp-refresh-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.rsp-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.rsp-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  border-radius: var(--radius-3);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  box-shadow: var(--shadow-1);
  transition:
    transform var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard);
}

.rsp-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-2);
}

.rsp-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-2);
  flex-shrink: 0;
}

.rsp-card-icon--time {
  background: color-mix(in srgb, var(--brand-400) 16%, transparent);
  color: var(--brand-500);
}

.rsp-card-icon--words {
  background: color-mix(in srgb, var(--green-500) 16%, transparent);
  color: var(--green-500);
}

.rsp-card-icon--books {
  background: color-mix(in srgb, var(--amber-500) 16%, transparent);
  color: var(--amber-500);
}

.rsp-card-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rsp-card-label {
  font-size: var(--fs-12);
  font-weight: var(--fw-medium);
  color: var(--color-text-soft);
  white-space: nowrap;
}

.rsp-card-value {
  font-size: var(--fs-18);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rsp-section {
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  border-radius: var(--radius-3);
  padding: 20px;
  box-shadow: var(--shadow-1);
}

.rsp-section-title {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  margin: 0 0 18px 0;
}

.rsp-bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  height: 140px;
}

.rsp-bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 56px;
}

.rsp-bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.rsp-bar {
  width: 100%;
  min-height: 4px;
  max-height: 100%;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(
    180deg,
    var(--brand-500),
    color-mix(in srgb, var(--brand-400) 60%, transparent)
  );
  position: relative;
  transition: height var(--dur-slow) var(--ease-standard);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.rsp-bar--empty {
  background: color-mix(in srgb, var(--color-border) 60%, transparent);
}

.rsp-bar-value {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--fs-11);
  font-weight: var(--fw-medium);
  color: var(--color-text);
  white-space: nowrap;
}

.rsp-bar-label {
  font-size: var(--fs-12);
  font-weight: var(--fw-medium);
  color: var(--color-text-soft);
}

.rsp-streak {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.rsp-streak-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--amber-500) 14%, transparent);
  color: var(--amber-500);
  flex-shrink: 0;
}

.rsp-streak-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rsp-streak-label {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--color-text-soft);
}

.rsp-streak-value {
  font-size: var(--fs-24);
  font-weight: var(--fw-bold);
  color: var(--amber-500);
}

.rsp-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-soft);
  font-size: var(--fs-14);
}

@media (max-width: 640px) {
  .rsp-cards {
    grid-template-columns: 1fr;
  }

  .rsp-bar-chart {
    gap: 8px;
    height: 120px;
  }

  .rsp-bar-value {
    font-size: var(--fs-10);
  }
}
</style>