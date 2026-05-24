<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useAchievementsStore } from '@/stores/achievements'
import { storeToRefs } from 'pinia'

const store = useAchievementsStore()
const { dailyGoalMinutes, goalProgress } = storeToRefs(store)

const size = 60
const strokeWidth = 5
const center = size / 2
const radius = center - strokeWidth / 2 - 1
const circumference = 2 * Math.PI * radius

const animatedOffset = ref(circumference)
const displayPct = ref(0)

function getColor(pct: number): string {
  if (pct >= 100) return '#22c55e'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
}

function animateTo(target: number): void {
  const start = displayPct.value
  const startOffset = circumference * (1 - start / 100)
  const targetOffset = circumference * (1 - target / 100)
  const startTime = performance.now()
  const duration = 600

  function step(currentTime: number): void {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(1 - progress, 4)
    animatedOffset.value = startOffset + (targetOffset - startOffset) * easeOut
    displayPct.value = Math.round(start + (target - start) * easeOut)
    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

watch(goalProgress, (val) => {
  animateTo(val)
}, { immediate: true })

onMounted(() => {
  animateTo(goalProgress.value)
})

const ringColor = computed(() => getColor(displayPct.value))
</script>

<template>
  <div class="reading-goal-ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        class="reading-goal-ring__bg"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
      />
      <circle
        class="reading-goal-ring__progress"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="animatedOffset"
        :stroke="ringColor"
      />
    </svg>
    <span class="reading-goal-ring__text">{{ displayPct }}%</span>
  </div>
</template>

<style scoped>
.reading-goal-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.reading-goal-ring svg {
  transform: rotate(-90deg);
  position: absolute;
  inset: 0;
}

.reading-goal-ring__bg {
  stroke: rgba(128, 128, 128, 0.2);
}

.reading-goal-ring__progress {
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}

.reading-goal-ring__text {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-base, #fff);
  z-index: 1;
  line-height: 1;
}
</style>