import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { safeRandomUUID } from "@/utils/uuid";

const STORAGE_KEY = "legado-update-feed";
const MAX_EVENTS = 200;

export interface UpdateEvent {
  id: string;
  bookId: string;
  bookName: string;
  coverUrl: string;
  newChapterCount: number;
  chapterNames: string[];
  detectedAt: number;
  isRead: boolean;
}

function loadEvents(): UpdateEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as UpdateEvent[];
      }
    }
  } catch {
    // ignore parse error
  }
  return [];
}

function saveEvents(events: UpdateEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore storage full
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {
    return "刚刚";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}天前`;
  }
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

export const useUpdateFeedStore = defineStore("updateFeed", () => {
  const events = ref<UpdateEvent[]>(loadEvents());

  const unreadCount = computed(() => events.value.filter((e) => !e.isRead).length);

  function persist() {
    const trimmed = events.value.slice(0, MAX_EVENTS);
    saveEvents(trimmed);
  }

  function addEvent(event: Omit<UpdateEvent, "id" | "detectedAt" | "isRead">) {
    const existing = events.value.find(
      (e) => e.bookId === event.bookId && !e.isRead,
    );
    if (existing) {
      const mergedNames = [...new Set([...existing.chapterNames, ...event.chapterNames])];
      existing.newChapterCount = mergedNames.length;
      existing.chapterNames = mergedNames;
      existing.detectedAt = Date.now();
      persist();
      return existing;
    }

    const newEvent: UpdateEvent = {
      id: safeRandomUUID(),
      bookId: event.bookId,
      bookName: event.bookName,
      coverUrl: event.coverUrl,
      newChapterCount: event.newChapterCount,
      chapterNames: event.chapterNames,
      detectedAt: Date.now(),
      isRead: false,
    };
    events.value.unshift(newEvent);
    persist();
    return newEvent;
  }

  function markRead(eventId: string) {
    const event = events.value.find((e) => e.id === eventId);
    if (event && !event.isRead) {
      event.isRead = true;
      persist();
    }
  }

  function markAllRead() {
    let changed = false;
    for (const event of events.value) {
      if (!event.isRead) {
        event.isRead = true;
        changed = true;
      }
    }
    if (changed) {
      persist();
    }
  }

  function getEvents(): UpdateEvent[] {
    return events.value;
  }

  return {
    events,
    unreadCount,
    addEvent,
    markRead,
    markAllRead,
    getEvents,
    formatRelativeTime,
  };
});