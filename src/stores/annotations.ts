import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { safeRandomUUID } from "@/utils/uuid";

export interface Annotation {
  id: string;
  bookId: string;
  chapterIndex: number;
  startOffset: number;
  endOffset: number;
  color: string;
  text: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "legado-reader-annotations";

function loadAll(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Annotation[]) : [];
  } catch {
    return [];
  }
}

function persist(items: Annotation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full or unavailable
  }
}

export const useAnnotationsStore = defineStore("annotations", () => {
  const annotations = ref<Annotation[]>(loadAll());

  function addAnnotation(
    entry: Omit<Annotation, "id" | "createdAt" | "updatedAt">,
  ): Annotation {
    const now = Date.now();
    const item: Annotation = {
      ...entry,
      id: safeRandomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    annotations.value = [...annotations.value, item];
    persist(annotations.value);
    return item;
  }

  function removeAnnotation(id: string) {
    annotations.value = annotations.value.filter((a) => a.id !== id);
    persist(annotations.value);
  }

  function updateAnnotationNote(id: string, note: string) {
    annotations.value = annotations.value.map((a) =>
      a.id === id ? { ...a, note, updatedAt: Date.now() } : a,
    );
    persist(annotations.value);
  }

  function updateAnnotationColor(id: string, color: string) {
    annotations.value = annotations.value.map((a) =>
      a.id === id ? { ...a, color, updatedAt: Date.now() } : a,
    );
    persist(annotations.value);
  }

  const getBookAnnotations = computed(() => (bookId: string) =>
    annotations.value.filter((a) => a.bookId === bookId),
  );

  const getChapterAnnotations = computed(() => (bookId: string, chapterIndex: number) =>
    annotations.value
      .filter((a) => a.bookId === bookId && a.chapterIndex === chapterIndex)
      .sort((a, b) => a.startOffset - b.startOffset),
  );

  function getAnnotationById(id: string): Annotation | undefined {
    return annotations.value.find((a) => a.id === id);
  }

  return {
    annotations,
    addAnnotation,
    removeAnnotation,
    updateAnnotationNote,
    updateAnnotationColor,
    getBookAnnotations,
    getChapterAnnotations,
    getAnnotationById,
  };
});