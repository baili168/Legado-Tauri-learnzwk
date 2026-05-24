import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isTauri } from "@/composables/useEnv";

const INCOGNITO_STORAGE_KEY = "legado-incognito-mode";
const INCOGNITO_DEFAULT_KEY = "legado-incognito-default";
const SKIPPED_BOOKS_KEY = "legado-incognito-skipped-books";

function loadIncognitoMode(): boolean {
  try {
    const raw = localStorage.getItem(INCOGNITO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : false;
  } catch {
    return false;
  }
}

function persistIncognitoMode(val: boolean) {
  try {
    localStorage.setItem(INCOGNITO_STORAGE_KEY, JSON.stringify(val));
  } catch {
    // storage full or unavailable
  }
}

function loadDefaultIncognito(): boolean {
  try {
    const raw = localStorage.getItem(INCOGNITO_DEFAULT_KEY);
    return raw ? JSON.parse(raw) : false;
  } catch {
    return false;
  }
}

function persistDefaultIncognito(val: boolean) {
  try {
    localStorage.setItem(INCOGNITO_DEFAULT_KEY, JSON.stringify(val));
  } catch {
    // storage full or unavailable
  }
}

function loadSkippedBooks(): Set<string> {
  try {
    const raw = localStorage.getItem(SKIPPED_BOOKS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistSkippedBooks(books: Set<string>) {
  try {
    localStorage.setItem(SKIPPED_BOOKS_KEY, JSON.stringify([...books]));
  } catch {
    // storage full or unavailable
  }
}

export const usePrivacyModeStore = defineStore("privacyMode", () => {
  const privacyModeEnabled = ref(false);
  const privacyExitTick = ref(0);
  const privacyExitReason = ref<"manual" | "background" | "close">("manual");

  const incognitoMode = ref(loadIncognitoMode());
  const defaultIncognito = ref(loadDefaultIncognito());
  const skippedBooks = ref<Set<string>>(loadSkippedBooks());

  let guardsInstalled = false;

  const isIncognito = computed(() => incognitoMode.value);

  function enterPrivacyMode() {
    privacyModeEnabled.value = true;
  }

  function exitPrivacyMode(reason: "manual" | "background" | "close" = "manual") {
    if (!privacyModeEnabled.value) {
      return;
    }
    privacyModeEnabled.value = false;
    privacyExitReason.value = reason;
    privacyExitTick.value += 1;
  }

  function togglePrivacyMode() {
    if (privacyModeEnabled.value) {
      exitPrivacyMode("manual");
    } else {
      enterPrivacyMode();
    }
  }

  function toggleIncognito() {
    incognitoMode.value = !incognitoMode.value;
    persistIncognitoMode(incognitoMode.value);
  }

  function setIncognito(val: boolean) {
    incognitoMode.value = val;
    persistIncognitoMode(val);
  }

  function setDefaultIncognito(val: boolean) {
    defaultIncognito.value = val;
    persistDefaultIncognito(val);
  }

  function addSkippedBook(bookId: string) {
    const next = new Set(skippedBooks.value);
    next.add(bookId);
    skippedBooks.value = next;
    persistSkippedBooks(next);
  }

  function isBookSkipped(bookId: string): boolean {
    return skippedBooks.value.has(bookId);
  }

  function clearSkippedBooks() {
    skippedBooks.value = new Set();
    persistSkippedBooks(new Set());
  }

  async function setupAutoExit() {
    if (guardsInstalled || typeof window === "undefined") {
      return;
    }
    guardsInstalled = true;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        exitPrivacyMode("background");
      }
    };
    const onPageHide = () => exitPrivacyMode("close");
    const onBeforeUnload = () => exitPrivacyMode("close");
    // Android WebView 中 visibilitychange:hidden 会在恢复时才触发，时机偏晚。
    // MainActivity.kt 在 onWindowFocusChanged(false) 时直接向 WebView 派发此事件，
    // 确保切换到后台时立即退出隐私模式。
    const onAppPaused = () => exitPrivacyMode("background");

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("legado:app-paused", onAppPaused);

    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        await appWindow.onFocusChanged(({ payload: focused }) => {
          if (!focused) {
            exitPrivacyMode("background");
          }
        });
        await appWindow.onCloseRequested(() => {
          exitPrivacyMode("close");
        });
      } catch {
        // 非 Tauri 环境忽略
      }
    }
  }

  return {
    privacyModeEnabled,
    privacyExitTick,
    privacyExitReason,
    incognitoMode,
    defaultIncognito,
    skippedBooks,
    isIncognito,
    enterPrivacyMode,
    exitPrivacyMode,
    togglePrivacyMode,
    toggleIncognito,
    setIncognito,
    setDefaultIncognito,
    addSkippedBook,
    isBookSkipped,
    clearSkippedBooks,
    setupAutoExit,
  };
});
