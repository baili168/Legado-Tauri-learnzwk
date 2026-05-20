<template>
  <div class="progress-ring-container" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg class="progress-ring" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        class="progress-ring-bg"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
      />

      <circle
        class="progress-ring-progress"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :class="{ completed: isCompleted }"
      />
    </svg>

    <div class="progress-ring-center">
      <span class="percentage">{{ displayPercentage }}%</span>
      <span v-if="showLabel" class="label">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';

interface Props {
  current: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  label?: string;
  animationDuration?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 120,
  strokeWidth: 8,
  showLabel: true,
  label: '今日进度',
  animationDuration: 600,
});

const animatedPercentage = ref(0);

const center = computed(() => props.size / 2);
const radius = computed(() => center.value - props.strokeWidth / 2 - 2);
const circumference = computed(() => 2 * Math.PI * radius.value);

const targetPercentage = computed(() => {
  if (props.goal === 0) return 0;
  return Math.min(100, (props.current / props.goal) * 100);
});

const isCompleted = computed(() => targetPercentage.value >= 100);

const dashOffset = computed(() => {
  const progress = animatedPercentage.value / 100;
  return circumference.value * (1 - progress);
});

const displayPercentage = computed(() => Math.round(animatedPercentage.value));

function animateTo(target: number) {
  const start = animatedPercentage.value;
  const startTime = performance.now();
  const duration = props.animationDuration;

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    animatedPercentage.value = start + (target - start) * easeOutQuart;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

watch(
  () => targetPercentage.value,
  (newVal) => {
    animateTo(newVal);
  },
  { immediate: true },
);

onMounted(() => {
  animateTo(targetPercentage.value);
});
</script>

<style scoped>
.progress-ring-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-bg {
  stroke: var(--gray-200);
}

.progress-ring-progress {
  stroke: var(--gray-400);
  stroke-linecap: round;
  transition: stroke var(--dur-base) var(--ease-standard);
}

.progress-ring-progress.completed {
  stroke: var(--green-500);
}

.progress-ring-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.percentage {
  font-size: var(--fs-20);
  font-weight: var(--fw-bold);
  color: var(--gray-800);
  line-height: 1;
}

.label {
  font-size: var(--fs-11);
  color: var(--gray-500);
  margin-top: var(--space-1);
}
</style>
