import { ref, readonly, shallowRef, type Ref } from "vue";

export interface TtsControllerState {
  isReading: Ref<boolean>;
  isPaused: Ref<boolean>;
  currentSentenceIndex: Ref<number>;
  sentences: Ref<string[]>;
  playbackRate: Ref<number>;
  error: Ref<string | null>;
}

export interface TtsControllerActions {
  start: (text: string, chapterKey?: string | number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBack: () => void;
  setPlaybackRate: (rate: number) => void;
}

export interface TtsControllerCallbacks {
  onSentenceChange?: (index: number) => void;
  onChapterEnd?: () => void;
  onAllDone?: () => void;
}

type ChapterProvider = (currentKey: string | number) => Promise<{
  text: string;
  key: string | number;
  hasMore: boolean;
} | null>;

let globalInstance: ReturnType<typeof createTtsController> | null = null;

function createTtsController() {
  const isReading = ref(false);
  const isPaused = ref(false);
  const currentSentenceIndex = ref(-1);
  const sentences = shallowRef<string[]>([]);
  const playbackRate = ref(1.0);
  const error = ref<string | null>(null);

  let internalSentences: string[] = [];
  let internalIndex = -1;
  let callbacks: TtsControllerCallbacks = {};
  let chapterProvider: ChapterProvider | null = null;
  let currentChapterKey: string | number = "";
  let stopped = false;
  let currentUtterance: SpeechSynthesisUtterance | null = null;

  const SENTENCE_DELIMITERS = /(?<=[。！？.!?；;：:\n])/u;
  const SENTENCE_FILTER = /[。！？.!?；;：:\n]/;

  function splitIntoSentences(text: string): string[] {
    if (!text || !text.trim()) {
      return [];
    }
    const parts = text.split(SENTENCE_DELIMITERS);
    const result: string[] = [];
    let buffer = "";
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      buffer += trimmed;
      if (SENTENCE_FILTER.test(trimmed) || buffer.length > 120) {
        result.push(buffer);
        buffer = "";
      }
    }
    if (buffer.trim()) {
      result.push(buffer.trim());
    }
    return result;
  }

  function cancelCurrentUtterance(): void {
    if (currentUtterance) {
      currentUtterance.onstart = null;
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
      currentUtterance.onboundary = null;
      currentUtterance = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function getVoices(): SpeechSynthesisVoice[] {
    if (!("speechSynthesis" in window)) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  }

  function pickBestVoice(): SpeechSynthesisVoice | null {
    const voices = getVoices();
    if (voices.length === 0) {
      return null;
    }
    const lang = navigator.language || "zh-CN";
    let exact = voices.find((v) => v.lang === lang && v.localService);
    if (exact) return exact;
    let prefix = voices.find(
      (v) => v.lang.startsWith(lang.substring(0, 2)) && v.localService,
    );
    if (prefix) return prefix;
    let anyLocal = voices.find((v) => v.localService);
    if (anyLocal) return anyLocal;
    return voices[0] ?? null;
  }

  function speakSentence(index: number): void {
    if (stopped || !isReading.value) {
      return;
    }

    if (index >= internalSentences.length) {
      handleChapterEnd();
      return;
    }

    internalIndex = index;
    currentSentenceIndex.value = index;

    if (callbacks.onSentenceChange) {
      callbacks.onSentenceChange(index);
    }

    const text = internalSentences[index];
    if (!text || !text.trim()) {
      speakSentence(index + 1);
      return;
    }

    cancelCurrentUtterance();

    if (!("speechSynthesis" in window)) {
      error.value = "当前环境不支持语音合成";
      stop();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    const voice = pickBestVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = playbackRate.value;
    utterance.volume = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      currentUtterance = null;
      if (!stopped && isReading.value) {
        speakSentence(index + 1);
      }
    };

    utterance.onerror = (e) => {
      currentUtterance = null;
      if (e.error === "canceled" || e.error === "interrupted") {
        return;
      }
      try {
        speakSentence(index + 1);
      } catch {
        error.value = `语音合成错误: ${e.error}`;
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      error.value = `启动语音合成失败: ${e}`;
      if (!stopped && isReading.value) {
        speakSentence(index + 1);
      }
    }
  }

  async function handleChapterEnd(): Promise<void> {
    if (!chapterProvider || !callbacks.onChapterEnd) {
      finishReading();
      return;
    }

    callbacks.onChapterEnd();

    const nextChapter = await chapterProvider(currentChapterKey);
    if (!nextChapter || stopped || !isReading.value) {
      finishReading();
      return;
    }

    currentChapterKey = nextChapter.key;
    const newSentences = splitIntoSentences(nextChapter.text);
    if (newSentences.length === 0) {
      finishReading();
      return;
    }

    internalSentences = newSentences;
    sentences.value = newSentences;
    internalIndex = -1;
    currentSentenceIndex.value = -1;

    speakSentence(0);
  }

  function finishReading(): void {
    isReading.value = false;
    isPaused.value = false;
    currentSentenceIndex.value = -1;
    callbacks.onAllDone?.();
  }

  function start(text: string, chapterKey?: string | number): void {
    stop();

    stopped = false;
    isReading.value = true;
    isPaused.value = false;
    error.value = null;

    currentChapterKey = chapterKey ?? "";

    internalSentences = splitIntoSentences(text);
    sentences.value = internalSentences;
    internalIndex = -1;
    currentSentenceIndex.value = -1;

    if (internalSentences.length === 0) {
      finishReading();
      return;
    }

    if (getVoices().length === 0) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => {
          if (!stopped && isReading.value && internalIndex < 0) {
            speakSentence(0);
          }
        },
        { once: true },
      );
    } else {
      speakSentence(0);
    }
  }

  function pause(): void {
    if (!isReading.value || isPaused.value) {
      return;
    }
    isPaused.value = true;
    isReading.value = false;
    cancelCurrentUtterance();
  }

  function resume(): void {
    if (!isPaused.value) {
      return;
    }
    isPaused.value = false;
    isReading.value = true;
    stopped = false;
    const resumeIndex = Math.max(0, internalIndex);
    if (resumeIndex < internalSentences.length) {
      speakSentence(resumeIndex);
    } else {
      handleChapterEnd();
    }
  }

  function stop(): void {
    stopped = true;
    isReading.value = false;
    isPaused.value = false;
    error.value = null;
    cancelCurrentUtterance();
    internalSentences = [];
    sentences.value = [];
    internalIndex = -1;
    currentSentenceIndex.value = -1;
    currentChapterKey = "";
    chapterProvider = null;
    callbacks = {};
  }

  function skipForward(): void {
    if (internalIndex < internalSentences.length - 1) {
      cancelCurrentUtterance();
      speakSentence(internalIndex + 1);
    } else {
      cancelCurrentUtterance();
      handleChapterEnd();
    }
  }

  function skipBack(): void {
    const target = Math.max(0, internalIndex - 1);
    cancelCurrentUtterance();
    speakSentence(target);
  }

  function setPlaybackRate(rate: number): void {
    playbackRate.value = Math.max(0.5, Math.min(3.0, rate));
  }

  function setCallbacks(cbs: TtsControllerCallbacks): void {
    callbacks = cbs;
  }

  function setChapterProvider(provider: ChapterProvider): void {
    chapterProvider = provider;
  }

  return {
    isReading: readonly(isReading),
    isPaused: readonly(isPaused),
    currentSentenceIndex: readonly(currentSentenceIndex),
    sentences: sentences as Ref<readonly string[]>,
    playbackRate: readonly(playbackRate),
    error: readonly(error),

    start,
    pause,
    resume,
    stop,
    skipForward,
    skipBack,
    setPlaybackRate,
    setCallbacks,
    setChapterProvider,
  };
}

export function useTtsController() {
  if (!globalInstance) {
    globalInstance = createTtsController();
  }
  return globalInstance;
}