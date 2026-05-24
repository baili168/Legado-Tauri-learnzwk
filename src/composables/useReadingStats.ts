export interface DailyStat {
  date: string
  minutesRead: number
  wordsRead: number
  booksOpened: number
}

export interface ReadingStats {
  totalMinutes: number
  totalWords: number
  totalBooks: number
  dailyStats: DailyStat[]
  currentStreak: number
}

const STORAGE_KEY = "legado:cumulativeStats"

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function loadDailyStats(): DailyStat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as DailyStat[]
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveDailyStats(stats: DailyStat[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    /* ignore quota errors */
  }
}

function calculateStreak(stats: DailyStat[]): number {
  if (stats.length === 0) return 0

  const sortedDates = [...new Set(stats.filter((s) => s.minutesRead > 0).map((s) => s.date))]
    .sort()
    .reverse()

  if (sortedDates.length === 0) return 0

  const today = todayStr()
  if (sortedDates[0] !== today) {
    const todayDate = new Date(today)
    const lastDate = new Date(sortedDates[0])
    const diffDays = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (diffDays > 1) return 0
  }

  let streak = 1
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const current = new Date(sortedDates[i])
    const prev = new Date(sortedDates[i + 1])
    const diff = Math.floor((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function useReadingStats() {
  function recordSession(bookId: string, durationMs: number, wordCount: number): void {
    if (durationMs <= 0) return

    const stats = loadDailyStats()
    const today = todayStr()
    const minutesRead = Math.round(durationMs / 60000)

    const existing = stats.find((s) => s.date === today)
    if (existing) {
      existing.minutesRead += minutesRead
      existing.wordsRead += wordCount
      if (bookId && !existing.booksOpened) {
        existing.booksOpened = 1
      }
    } else {
      stats.push({
        date: today,
        minutesRead,
        wordsRead: wordCount,
        booksOpened: bookId ? 1 : 0,
      })
    }

    saveDailyStats(stats)
  }

  function getStats(): ReadingStats {
    const stats = loadDailyStats()
    const totalMinutes = stats.reduce((sum, s) => sum + s.minutesRead, 0)
    const totalWords = stats.reduce((sum, s) => sum + s.wordsRead, 0)
    const totalBooks = new Set(stats.filter((s) => s.booksOpened > 0).length).size || stats.length
    return {
      totalMinutes,
      totalWords,
      totalBooks,
      dailyStats: stats,
      currentStreak: calculateStreak(stats),
    }
  }

  function getWeeklyStats(): DailyStat[] {
    const stats = loadDailyStats()
    const result: DailyStat[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      const dateStr = `${y}-${m}-${day}`
      const existing = stats.find((s) => s.date === dateStr)
      if (existing) {
        result.push({ ...existing })
      } else {
        result.push({ date: dateStr, minutesRead: 0, wordsRead: 0, booksOpened: 0 })
      }
    }
    return result
  }

  return {
    recordSession,
    getStats,
    getWeeklyStats,
    loadDailyStats,
  }
}