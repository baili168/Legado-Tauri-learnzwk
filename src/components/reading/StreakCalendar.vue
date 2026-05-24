<template>
  <div class="streak-calendar">
    <div class="calendar-header">
      <button class="nav-btn" @click="prevMonth">
        <ChevronLeft :size="20" />
      </button>

      <h3 class="month-title">{{ monthTitle }}</h3>

      <button class="nav-btn" @click="nextMonth">
        <ChevronRight :size="20" />
      </button>
    </div>

    <div class="calendar-grid">
      <div class="weekday-header">
        <span v-for="day in weekdays" :key="day" class="weekday">{{ day }}</span>
      </div>

      <div class="days-grid">
        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          class="day-cell"
          :class="{
            'has-data': day.intensity > 0,
            [`intensity-${day.intensity}`]: day.intensity > 0,
            'is-streak': day.isStreak,
            'is-empty': !day.date,
          }"
          :title="day.date ? getTooltip(day) : ''"
        >
          <span v-if="day.date" class="day-number">{{ getDayNumber(day.date) }}</span>
        </div>
      </div>
    </div>

    <div class="calendar-footer">
      <div class="streak-badge">
        <Flame :size="16" class="flame-icon" />
        <span>连续 {{ streakDays }} 天</span>
      </div>

      <div class="week-stats">
        <span class="stat-item">
          <BookOpen :size="14" />
          {{ weekStats.daysRead }} 天 / 本周
        </span>
        <span class="stat-item">
          <Clock :size="14" />
          {{ weekStats.totalMinutes }} 分钟
        </span>
      </div>
    </div>

    <div class="intensity-legend">
      <span class="legend-label">阅读强度:</span>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-box intensity-0"></div>
          <span>无</span>
        </div>
        <div class="legend-item">
          <div class="legend-box intensity-1"></div>
          <span>1-15分钟</span>
        </div>
        <div class="legend-item">
          <div class="legend-box intensity-2"></div>
          <span>16-30分钟</span>
        </div>
        <div class="legend-item">
          <div class="legend-box intensity-3"></div>
          <span>30+分钟</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ChevronLeft, ChevronRight, Flame, BookOpen, Clock } from "lucide-vue-next";
import { useReadingGoalStore } from "@/stores/readingGoal";

interface CalendarDay {
  date: string;
  hasRead: boolean;
  intensity: 0 | 1 | 2 | 3;
  isStreak: boolean;
}

const props = defineProps<{
  year: number;
  month: number;
  history: string[];
}>();

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

const currentYear = ref(props.year);
const currentMonth = ref(props.month);

const readingGoalStore = useReadingGoalStore();

const streakDays = computed(() => readingGoalStore.streakDays);
const weekStats = computed(() => readingGoalStore.getWeekStats());

const monthTitle = computed(() => {
  return `${currentYear.value}年 ${currentMonth.value}月`;
});

const calendarDays = computed(() => {
  return readingGoalStore.getMonthCalendar(currentYear.value, currentMonth.value);
});

function getDayNumber(dateStr: string): number {
  const parts = dateStr.split("-");
  return parseInt(parts[2], 10);
}

function getTooltip(day: CalendarDay): string {
  if (!day.date || !day.hasRead) return day.date;
  const record = readingGoalStore.getDailyRecord(day.date);
  if (record) {
    return `${day.date}: ${record.minutes} 分钟`;
  }
  return day.date;
}

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
}
</script>

<style scoped>
.streak-calendar {
  background: var(--gray-0);
  border-radius: var(--radius-3);
  padding: var(--space-4);
  box-shadow: var(--shadow-1);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: var(--gray-100);
  border-radius: var(--radius-1);
  color: var(--gray-600);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-standard);
}

.nav-btn:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.month-title {
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--gray-800);
  margin: 0;
}

.calendar-grid {
  margin-bottom: var(--space-4);
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}

.weekday {
  text-align: center;
  font-size: var(--fs-12);
  font-weight: var(--fw-medium);
  color: var(--gray-500);
  padding: var(--space-1);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-1);
  background: var(--gray-100);
  transition: all var(--dur-fast) var(--ease-standard);
  cursor: default;
  position: relative;
}

.day-cell.is-empty {
  background: transparent;
}

.day-cell:not(.is-empty):hover {
  transform: scale(1.1);
}

.day-cell.is-streak {
  box-shadow: inset 0 0 0 2px var(--brand-400);
}

.day-cell.intensity-0 {
  background: var(--gray-100);
}

.day-cell.intensity-1 {
  background: #dcfce7;
}

.day-cell.intensity-2 {
  background: #86efac;
}

.day-cell.intensity-3 {
  background: #22c55e;
}

.day-number {
  font-size: var(--fs-11);
  font-weight: var(--fw-medium);
  color: var(--gray-700);
}

.day-cell.intensity-3 .day-number {
  color: var(--gray-0);
}

.calendar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-3);
  border-top: 1px solid var(--gray-200);
  margin-bottom: var(--space-3);
}

.streak-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--amber-500);
}

.flame-icon {
  color: var(--amber-500);
}

.week-stats {
  display: flex;
  gap: var(--space-3);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-12);
  color: var(--gray-600);
}

.intensity-legend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.legend-label {
  font-size: var(--fs-11);
  color: var(--gray-500);
}

.legend-items {
  display: flex;
  gap: var(--space-2);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-10);
  color: var(--gray-500);
}

.legend-box {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-box.intensity-0 {
  background: var(--gray-100);
}

.legend-box.intensity-1 {
  background: #dcfce7;
}

.legend-box.intensity-2 {
  background: #86efac;
}

.legend-box.intensity-3 {
  background: #22c55e;
}
</style>
