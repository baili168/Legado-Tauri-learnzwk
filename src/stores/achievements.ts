import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useReadingGoalStore } from './readingGoal'
import { useReadingStatsStore } from './readingStats'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt: number | null
}

interface AchievementDef extends Achievement {
  condition: () => boolean
}

interface AchievementsData {
  dailyGoalMinutes: number
  streak: number
  lastReadDate: string
  finishedBooks: number
  totalHours: number
  exploredBooks: number
  unlockedAchievements: Record<string, number>
}

const STORAGE_KEY = 'legado:achievements'

function getTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const useAchievementsStore = defineStore('achievements', () => {
  const dailyGoalMinutes = ref(30)
  const streak = ref(0)
  const lastReadDate = ref('')
  const finishedBooks = ref(0)
  const totalHours = ref(0)
  const exploredBooks = ref(0)
  const unlockedAchievements = ref<Record<string, number>>({})

  const toasts = ref<Achievement[]>([])

  const achievementDefs: AchievementDef[] = [
    { id: 'streak_7', name: '一周目', description: '连续阅读 7 天', icon: '🔥', unlockedAt: null, condition: () => streak.value >= 7 },
    { id: 'streak_30', name: '阅读达人', description: '连续阅读 30 天', icon: '👑', unlockedAt: null, condition: () => streak.value >= 30 },
    { id: 'books_10', name: '博览群书', description: '读完 10 本书', icon: '📚', unlockedAt: null, condition: () => finishedBooks.value >= 10 },
    { id: 'hours_100', name: '书虫', description: '累计阅读 100 小时', icon: '⏰', unlockedAt: null, condition: () => totalHours.value >= 100 },
    { id: 'explore_50', name: '探索者', description: '发现 50 本新书', icon: '🔍', unlockedAt: null, condition: () => exploredBooks.value >= 50 },
  ]

  const list = computed<Achievement[]>(() => {
    return achievementDefs.map((def) => ({
      ...def,
      unlockedAt: unlockedAchievements.value[def.id] ?? null,
    }))
  })

  const unlockedCount = computed(() => Object.keys(unlockedAchievements.value).length)

  const todayMinutes = computed(() => {
    const goalStore = useReadingGoalStore()
    return goalStore.todayMinutes
  })

  const goalProgress = computed(() => {
    if (dailyGoalMinutes.value === 0) return 0
    return Math.min(100, (todayMinutes.value / dailyGoalMinutes.value) * 100)
  })

  function load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data: AchievementsData = JSON.parse(raw)
      dailyGoalMinutes.value = data.dailyGoalMinutes ?? 30
      streak.value = data.streak ?? 0
      lastReadDate.value = data.lastReadDate ?? ''
      finishedBooks.value = data.finishedBooks ?? 0
      totalHours.value = data.totalHours ?? 0
      exploredBooks.value = data.exploredBooks ?? 0
      unlockedAchievements.value = data.unlockedAchievements ?? {}
    } catch {
      /* ignore */
    }
  }

  function save(): void {
    try {
      const data: AchievementsData = {
        dailyGoalMinutes: dailyGoalMinutes.value,
        streak: streak.value,
        lastReadDate: lastReadDate.value,
        finishedBooks: finishedBooks.value,
        totalHours: totalHours.value,
        exploredBooks: exploredBooks.value,
        unlockedAchievements: unlockedAchievements.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* ignore quota errors */
    }
  }

  function setDailyGoal(min: number): void {
    dailyGoalMinutes.value = Math.max(10, Math.min(120, Math.round(min)))
    save()
  }

  function updateStreak(): void {
    const today = getTodayStr()
    if (lastReadDate.value === today) return

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    if (lastReadDate.value === yesterdayStr) {
      streak.value += 1
    } else {
      streak.value = 1
    }

    lastReadDate.value = today
    save()
    checkAllAchievements()
  }

  function recordFinishedBook(): void {
    finishedBooks.value += 1
    save()
    checkAllAchievements()
  }

  function recordExploredBook(): void {
    exploredBooks.value += 1
    save()
    checkAllAchievements()
  }

  function addReadingMinutes(mins: number): void {
    totalHours.value += mins / 60
    updateStreak()
    save()
    checkAllAchievements()
  }

  function checkAndUnlock(): Achievement[] {
    const newlyUnlocked: Achievement[] = []

    for (const def of achievementDefs) {
      if (unlockedAchievements.value[def.id]) continue
      if (def.condition()) {
        const now = Date.now()
        unlockedAchievements.value[def.id] = now
        newlyUnlocked.push({ ...def, unlockedAt: now })
      }
    }

    if (newlyUnlocked.length > 0) {
      save()
      newlyUnlocked.forEach((a) => {
        toasts.value.push(a)
        setTimeout(() => {
          const idx = toasts.value.findIndex((t) => t.id === a.id)
          if (idx >= 0) toasts.value.splice(idx, 1)
        }, 4000)
      })
    }

    return newlyUnlocked
  }

  function checkAllAchievements(): void {
    checkAndUnlock()
  }

  function dismissToast(id: string): void {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx >= 0) toasts.value.splice(idx, 1)
  }

  function syncFromReadingGoal(): void {
    const goalStore = useReadingGoalStore()
    const updated = goalStore.todayMinutes > 0
    if (updated) {
      updateStreak()
      checkAllAchievements()
    }
  }

  function syncFromStats(): void {
    const statsStore = useReadingStatsStore()
    statsStore.loadSessions()
    const globalStats = statsStore.getGlobalStats()
    totalHours.value = Math.round(globalStats.totalDuration / 3600)
    save()
    checkAllAchievements()
  }

  load()

  return {
    dailyGoalMinutes,
    streak,
    lastReadDate,
    finishedBooks,
    totalHours,
    exploredBooks,
    unlockedAchievements,
    toasts,
    list,
    unlockedCount,
    todayMinutes,
    goalProgress,
    load,
    save,
    setDailyGoal,
    updateStreak,
    recordFinishedBook,
    recordExploredBook,
    addReadingMinutes,
    checkAndUnlock,
    checkAllAchievements,
    dismissToast,
    syncFromReadingGoal,
    syncFromStats,
  }
})