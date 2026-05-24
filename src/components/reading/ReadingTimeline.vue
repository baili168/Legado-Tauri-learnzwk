<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReadingRecordsStore } from '@/stores/readingRecords'

const emit = defineEmits<{
  'select-day': [date: string]
}>()

const store = useReadingRecordsStore()

const DAYS = 90
const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const heatmapData = computed(() => store.getHeatmapData(DAYS))

const gridCells = computed(() => {
  const cells: { date: string; duration: number; empty: boolean; col: number; row: number; label: string; monthLabel: string }[] = []
  const now = new Date()
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - DAYS + 1)
  startDate.setHours(0, 0, 0, 0)

  const firstDayOfWeek = startDate.getDay()
  const adjustedFirst = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  for (let i = 0; i < adjustedFirst; i++) {
    cells.push({ date: '', duration: 0, empty: true, col: 0, row: i, label: '', monthLabel: '' })
  }

  let currentCol = 0
  let lastMonth = -1
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dow = d.getDay()
    const row = dow === 0 ? 6 : dow - 1
    const dur = heatmapData.value.get(key) ?? 0

    const currentMonth = d.getMonth()
    const monthLabel = currentMonth !== lastMonth ? `${d.getMonth() + 1}月` : ''
    lastMonth = currentMonth

    cells.push({ date: key, duration: dur, empty: false, col: currentCol, row, label: `${key}`, monthLabel })
    if (row === 6) currentCol++
  }
  return cells
})

const totalCols = computed(() => {
  const max = gridCells.value.reduce((m, c) => Math.max(m, c.col), 0)
  return max + 1
})

const selectedDay = ref('')
const tooltipCell = ref<{ date: string; duration: number; x: number; y: number } | null>(null)

function getIntensityClass(duration: number): string {
  if (duration <= 0) return 'rht-cell--i0'
  if (duration <= 600) return 'rht-cell--i1'
  if (duration <= 1800) return 'rht-cell--i2'
  if (duration <= 3600) return 'rht-cell--i3'
  return 'rht-cell--i4'
}

function formatDurationTooltip(secs: number): string {
  if (secs <= 0) return '0分钟'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}小时${m}分钟`
}

function onCellClick(cell: { date: string; duration: number; empty: boolean }) {
  if (cell.empty) return
  selectedDay.value = cell.date
  emit('select-day', cell.date)
}

function onCellEnter(cell: { date: string; duration: number; empty: boolean }, event: MouseEvent) {
  if (cell.empty) {
    tooltipCell.value = null
    return
  }
  tooltipCell.value = { date: cell.date, duration: cell.duration, x: 0, y: 0 }
}

function onCellLeave() {
  tooltipCell.value = null
}
</script>

<template>
  <div class="rht-root">
    <div class="rht-grid-container">
      <div class="rht-month-labels" :style="{ gridColumn: `1 / span ${totalCols}` }">
        <template v-for="cell in gridCells" :key="'ml-' + cell.date + '-' + cell.col">
          <span
            v-if="cell.monthLabel"
            class="rht-month-label"
            :style="{ gridColumn: cell.col + 1 }"
          >{{ cell.monthLabel }}</span>
        </template>
      </div>
      <div class="rht-grid-body">
        <div class="rht-day-labels">
          <span v-for="(day, i) in DAY_LABELS" :key="day" class="rht-day-label">{{ i % 2 === 1 ? day : '' }}</span>
        </div>
        <div
          class="rht-grid"
          :style="{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }"
        >
          <template v-for="cell in gridCells" :key="cell.date + '-' + cell.col + '-' + cell.row">
            <div
              v-if="!cell.empty"
              class="rht-cell"
              :class="[getIntensityClass(cell.duration), { 'rht-cell--selected': selectedDay === cell.date }]"
              :title="cell.label + ': ' + formatDurationTooltip(cell.duration)"
              @click="onCellClick(cell)"
              @mouseenter="onCellEnter(cell, $event)"
              @mouseleave="onCellLeave"
            />
            <div v-else class="rht-cell rht-cell--empty" />
          </template>
        </div>
      </div>
    </div>
    <div class="rht-legend">
      <span class="rht-legend-label">少</span>
      <div class="rht-legend-swatch rht-cell--i0" />
      <div class="rht-legend-swatch rht-cell--i1" />
      <div class="rht-legend-swatch rht-cell--i2" />
      <div class="rht-legend-swatch rht-cell--i3" />
      <div class="rht-legend-swatch rht-cell--i4" />
      <span class="rht-legend-label">多</span>
    </div>
  </div>
</template>

<style scoped>
.rht-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.rht-grid-container {
  width: 100%;
  overflow-x: auto;
  padding: 0 var(--space-1);
}

.rht-month-labels {
  display: grid;
  grid-template-columns: 28px repeat(v-bind('totalCols - 1'), 1fr);
  margin-bottom: 2px;
  padding-left: 28px;
}

.rht-month-label {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  text-align: left;
  padding-left: 2px;
}

.rht-grid-body {
  display: flex;
  gap: 4px;
}

.rht-day-labels {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
  width: 24px;
  padding-top: 1px;
}

.rht-day-label {
  font-size: 9px;
  color: var(--color-text-muted);
  line-height: 14px;
  text-align: right;
  height: 14px;
}

.rht-grid {
  display: grid;
  grid-template-rows: repeat(7, 14px);
  gap: 3px;
  flex: 1;
}

.rht-cell {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.1s ease, outline 0.1s ease;
}

.rht-cell--empty {
  background: transparent;
  cursor: default;
}

.rht-cell:not(.rht-cell--empty):hover {
  transform: scale(1.3);
  z-index: 1;
}

.rht-cell--selected {
  outline: 2px solid var(--color-accent);
  outline-offset: 0px;
  z-index: 1;
}

.rht-cell--i0 {
  background: var(--color-surface-soft, #e5e7eb);
}

.rht-cell--i1 {
  background: #bbf7d0;
}

.rht-cell--i2 {
  background: #86efac;
}

.rht-cell--i3 {
  background: #4ade80;
}

.rht-cell--i4 {
  background: #16a34a;
}

.rht-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: var(--space-1) 0;
}

.rht-legend-label {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
}

.rht-legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.rht-legend-swatch.rht-cell--i0 {
  background: var(--color-surface-soft, #e5e7eb);
}

.rht-legend-swatch.rht-cell--i1 {
  background: #bbf7d0;
}

.rht-legend-swatch.rht-cell--i2 {
  background: #86efac;
}

.rht-legend-swatch.rht-cell--i3 {
  background: #4ade80;
}

.rht-legend-swatch.rht-cell--i4 {
  background: #16a34a;
}
</style>