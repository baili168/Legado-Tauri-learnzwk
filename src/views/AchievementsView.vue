<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAchievementsStore } from '@/stores/achievements'

const store = useAchievementsStore()
const { list, unlockedCount, dailyGoalMinutes, goalProgress, todayMinutes } = storeToRefs(store)

function onGoalChange(e: Event) {
  const target = e.target as HTMLInputElement
  store.setDailyGoal(Number(target.value))
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="achievements-view">
    <div class="achievements-view__header">
      <h2 class="achievements-view__title">成就</h2>
      <span class="achievements-view__count">{{ unlockedCount }} / {{ list.length }}</span>
    </div>

    <section class="achievements-view__goal">
      <div class="achievements-view__goal-header">
        <span class="achievements-view__goal-label">每日阅读目标</span>
        <span class="achievements-view__goal-value">{{ todayMinutes }} / {{ dailyGoalMinutes }} 分钟</span>
      </div>
      <div class="achievements-view__goal-slider">
        <input
          type="range"
          :min="10"
          :max="120"
          :step="5"
          :value="dailyGoalMinutes"
          class="achievements-view__slider"
          @input="onGoalChange"
        />
        <div class="achievements-view__goal-marks">
          <span>10</span>
          <span>60</span>
          <span>120</span>
        </div>
      </div>
      <div class="achievements-view__goal-bar">
        <div
          class="achievements-view__goal-bar-fill"
          :style="{ width: `${Math.min(100, goalProgress)}%` }"
        />
      </div>
    </section>

    <div class="achievements-view__grid">
      <div
        v-for="item in list"
        :key="item.id"
        class="achievement-card"
        :class="{ 'achievement-card--unlocked': item.unlockedAt }"
      >
        <span class="achievement-card__icon">{{ item.unlockedAt ? item.icon : '🔒' }}</span>
        <div class="achievement-card__info">
          <span class="achievement-card__name">{{ item.name }}</span>
          <span class="achievement-card__desc">{{ item.description }}</span>
          <span v-if="item.unlockedAt" class="achievement-card__date">
            {{ formatDate(item.unlockedAt) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.achievements-view {
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}

.achievements-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.achievements-view__title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.achievements-view__count {
  font-size: 0.875rem;
  color: var(--color-text-muted, #a1a1aa);
}

.achievements-view__goal {
  background: var(--color-card-bg, #27272a);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.achievements-view__goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.achievements-view__goal-label {
  font-size: 0.875rem;
  font-weight: 600;
}

.achievements-view__goal-value {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #a1a1aa);
}

.achievements-view__goal-slider {
  margin-bottom: 12px;
}

.achievements-view__slider {
  width: 100%;
  accent-color: var(--color-primary, #818cf8);
  height: 6px;
}

.achievements-view__goal-marks {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--color-text-muted, #71717a);
  margin-top: 2px;
}

.achievements-view__goal-bar {
  height: 6px;
  background: rgba(128, 128, 128, 0.15);
  border-radius: 3px;
  overflow: hidden;
}

.achievements-view__goal-bar-fill {
  height: 100%;
  background: var(--color-primary, #818cf8);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.achievements-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.achievement-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  background: var(--color-card-bg, #27272a);
  border: 1px solid var(--color-card-border, #3f3f46);
  transition: border-color 0.2s;
}

.achievement-card--unlocked {
  border-color: var(--color-primary, #818cf8);
}

.achievement-card__icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.achievement-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.achievement-card__name {
  font-size: 0.8125rem;
  font-weight: 700;
}

.achievement-card__desc {
  font-size: 0.6875rem;
  color: var(--color-text-muted, #a1a1aa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.achievement-card__date {
  font-size: 0.625rem;
  color: var(--color-primary, #818cf8);
  margin-top: 2px;
}
</style>