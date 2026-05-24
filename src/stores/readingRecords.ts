import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ReadingSession {
  id: string
  bookId: string
  bookName: string
  coverUrl: string
  startTime: number
  endTime: number
  duration: number
  startChapter: number
  endChapter: number
  pagesRead: number
}

export interface DailyRecord {
  date: string
  totalDuration: number
  totalPages: number
  sessions: ReadingSession[]
}

export const useReadingRecordsStore = defineStore('readingRecords', () => {
  const sessions = ref<ReadingSession[]>([])

  function load() {
    try {
      const raw = localStorage.getItem('readingRecords_sessions')
      if (raw) sessions.value = JSON.parse(raw)
    } catch {}
  }

  function save() {
    localStorage.setItem('readingRecords_sessions', JSON.stringify(sessions.value.slice(-500)))
  }

  load()

  function addSession(session: ReadingSession) {
    sessions.value.push(session)
    save()
  }

  function getDailyRecord(date: string): DailyRecord {
    const daySessions = sessions.value.filter(s => {
      const d = new Date(s.startTime)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === date
    })
    return {
      date,
      totalDuration: daySessions.reduce((sum, s) => sum + s.duration, 0),
      totalPages: daySessions.reduce((sum, s) => sum + s.pagesRead, 0),
      sessions: daySessions
    }
  }

  function getHeatmapData(days: number): Map<string, number> {
    const map = new Map<string, number>()
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const record = getDailyRecord(key)
      map.set(key, record.totalDuration)
    }
    return map
  }

  function getBookSessions(bookId: string): ReadingSession[] {
    return sessions.value.filter(s => s.bookId === bookId)
  }

  const totalReadingTime = computed(() => sessions.value.reduce((s, r) => s + r.duration, 0))
  const totalPagesRead = computed(() => sessions.value.reduce((s, r) => s + r.pagesRead, 0))

  return { sessions, addSession, getDailyRecord, getHeatmapData, getBookSessions, totalReadingTime, totalPagesRead }
})