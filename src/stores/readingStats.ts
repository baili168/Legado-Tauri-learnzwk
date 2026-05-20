import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { safeRandomUUID } from '@/utils/uuid';

export interface ReadingSession {
  id: string;
  bookId: string;
  bookName: string;
  date: string;
  startTime: number;
  endTime: number;
  durationSecs: number;
  wordsRead: number;
  chapterIndex: number;
}

export interface BookStats {
  totalDuration: number;
  totalSessions: number;
  totalWords: number;
  readingDays: number;
  avgSpeed: number;
  firstReadDate: string | null;
  lastReadDate: string | null;
}

export interface GlobalStats {
  totalDuration: number;
  totalSessions: number;
  totalWords: number;
  totalBooks: number;
  totalDays: number;
  avgDailyMinutes: number;
  mostReadBook: { bookId: string; bookName: string; duration: number } | null;
}

export interface DailyHeatmapEntry {
  date: string;
  minutes: number;
}

const STORAGE_KEY = 'legado:readingSessions';

function getDateString(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const useReadingStatsStore = defineStore('readingStats', () => {
  const sessions = ref<ReadingSession[]>([]);
  const loaded = ref(false);

  function loadSessions(): void {
    if (loaded.value) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        sessions.value = JSON.parse(raw) as ReadingSession[];
      }
    } catch {
      sessions.value = [];
    }
    loaded.value = true;
  }

  function saveSessions(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value));
    } catch {
      /* ignore quota errors */
    }
  }

  function startSession(
    bookId: string,
    bookName: string,
    chapterIndex: number,
  ): string {
    loadSessions();
    const id = safeRandomUUID();
    const now = Date.now();
    const date = getDateString(now);
    const session: ReadingSession = {
      id,
      bookId,
      bookName,
      date,
      startTime: now,
      endTime: 0,
      durationSecs: 0,
      wordsRead: 0,
      chapterIndex,
    };
    sessions.value.push(session);
    saveSessions();
    return id;
  }

  function endSession(sessionId: string, wordsRead: number): void {
    loadSessions();
    const session = sessions.value.find((s) => s.id === sessionId);
    if (!session) return;
    const now = Date.now();
    session.endTime = now;
    session.durationSecs = Math.max(
      0,
      Math.round((now - session.startTime) / 1000),
    );
    session.wordsRead = wordsRead;
    saveSessions();
  }

  function getBookStats(bookId: string): BookStats {
    loadSessions();
    const bookSessions = sessions.value.filter((s) => s.bookId === bookId);
    if (bookSessions.length === 0) {
      return {
        totalDuration: 0,
        totalSessions: 0,
        totalWords: 0,
        readingDays: 0,
        avgSpeed: 0,
        firstReadDate: null,
        lastReadDate: null,
      };
    }

    const sorted = [...bookSessions].sort(
      (a, b) => a.startTime - b.startTime,
    );
    const totalDuration = bookSessions.reduce(
      (sum, s) => sum + s.durationSecs,
      0,
    );
    const totalWords = bookSessions.reduce(
      (sum, s) => sum + s.wordsRead,
      0,
    );
    const dateSet = new Set(bookSessions.map((s) => s.date));
    const readingDays = dateSet.size;
    const totalMinutes = totalDuration / 60;
    const avgSpeed =
      totalMinutes > 0
        ? Math.round(totalWords / totalMinutes)
        : 0;
    const firstReadDate = sorted[0].date;
    const lastReadDate = sorted[sorted.length - 1].date;

    return {
      totalDuration,
      totalSessions: bookSessions.length,
      totalWords,
      readingDays,
      avgSpeed,
      firstReadDate,
      lastReadDate,
    };
  }

  function getGlobalStats(): GlobalStats {
    loadSessions();
    const allSessions = sessions.value;
    if (allSessions.length === 0) {
      return {
        totalDuration: 0,
        totalSessions: 0,
        totalWords: 0,
        totalBooks: 0,
        totalDays: 0,
        avgDailyMinutes: 0,
        mostReadBook: null,
      };
    }

    const totalDuration = allSessions.reduce(
      (sum, s) => sum + s.durationSecs,
      0,
    );
    const totalWords = allSessions.reduce(
      (sum, s) => sum + s.wordsRead,
      0,
    );
    const bookIdSet = new Set(allSessions.map((s) => s.bookId));
    const totalBooks = bookIdSet.size;

    const dateSet = new Set(allSessions.map((s) => s.date));
    const totalDays = dateSet.size;
    const avgDailyMinutes =
      totalDays > 0
        ? Math.round((totalDuration / 60 / totalDays) * 10) / 10
        : 0;

    const bookDurationMap = new Map<
      string,
      { bookId: string; bookName: string; duration: number }
    >();
    for (const s of allSessions) {
      const existing = bookDurationMap.get(s.bookId);
      if (existing) {
        existing.duration += s.durationSecs;
      } else {
        bookDurationMap.set(s.bookId, {
          bookId: s.bookId,
          bookName: s.bookName,
          duration: s.durationSecs,
        });
      }
    }

    let mostReadBook: GlobalStats['mostReadBook'] = null;
    let maxDuration = 0;
    for (const entry of bookDurationMap.values()) {
      if (entry.duration > maxDuration) {
        maxDuration = entry.duration;
        mostReadBook = entry;
      }
    }

    return {
      totalDuration,
      totalSessions: allSessions.length,
      totalWords,
      totalBooks,
      totalDays,
      avgDailyMinutes,
      mostReadBook,
    };
  }

  function getDailyHeatmap(year: number, month: number): DailyHeatmapEntry[] {
    loadSessions();
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const dayMinutesMap = new Map<string, number>();

    for (const s of sessions.value) {
      if (!s.date.startsWith(prefix)) continue;
      const current = dayMinutesMap.get(s.date) ?? 0;
      dayMinutesMap.set(
        s.date,
        current + Math.round(s.durationSecs / 60),
      );
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const result: DailyHeatmapEntry[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${prefix}${String(d).padStart(2, '0')}`;
      result.push({
        date,
        minutes: dayMinutesMap.get(date) ?? 0,
      });
    }
    return result;
  }

  function getBookReadDates(bookId: string): string[] {
    loadSessions();
    const dateSet = new Set(
      sessions.value
        .filter((s) => s.bookId === bookId && s.durationSecs > 0)
        .map((s) => s.date),
    );
    return [...dateSet].sort();
  }

  function compactSessions(): void {
    loadSessions();
    const groups = new Map<string, ReadingSession[]>();

    for (const s of sessions.value) {
      const key = `${s.bookId}|${s.date}`;
      const group = groups.get(key);
      if (group) {
        group.push(s);
      } else {
        groups.set(key, [s]);
      }
    }

    const compacted: ReadingSession[] = [];

    for (const group of groups.values()) {
      if (group.length <= 1) {
        compacted.push(...group);
        continue;
      }

      const sorted = [...group].sort(
        (a, b) => a.startTime - b.startTime,
      );

      const merged: ReadingSession = {
        ...sorted[0],
        id: sorted[0].id,
        endTime: sorted[sorted.length - 1].endTime || sorted[sorted.length - 1].startTime,
        durationSecs: sorted.reduce(
          (sum, s) => sum + s.durationSecs,
          0,
        ),
        wordsRead: sorted.reduce((sum, s) => sum + s.wordsRead, 0),
      };

      compacted.push(merged);
    }

    sessions.value = compacted.sort(
      (a, b) => b.startTime - a.startTime,
    );
    saveSessions();
  }

  const sessionCount = computed(() => {
    loadSessions();
    return sessions.value.length;
  });

  return {
    sessions,
    loaded,
    sessionCount,
    loadSessions,
    saveSessions,
    startSession,
    endSession,
    getBookStats,
    getGlobalStats,
    getDailyHeatmap,
    getBookReadDates,
    compactSessions,
  };
});