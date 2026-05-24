import type { ComputedRef, Ref } from "vue";
import { nextTick, ref, watch } from "vue";
import { useTts, splitIntoSegments } from "@/composables/useTts";
import { useTtsController } from "@/composables/useTtsController";
import type { PagedModeApi, ScrollModeApi } from "./useReaderModeBridge";

interface UseReaderTtsManagerOptions {
  activeChapterIndex: Ref<number>;
  content: Ref<string>;
  isPagedMode: ComputedRef<boolean>;
  isScrollMode: ComputedRef<boolean>;
  isComicMode: ComputedRef<boolean>;
  isVideoMode: ComputedRef<boolean>;
  pagedPageIndex: Ref<number>;
  activePagedPages: ComputedRef<string[]>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  pagedModeRef: Ref<PagedModeApi | null>;
  scrollModeRef: Ref<ScrollModeApi | null>;
  blockingLoading: ComputedRef<boolean>;
  setPagedPage: (page: number) => void;
  fetchRawChapterText: (index: number) => Promise<string>;
  gotoNextChapter: () => Promise<void>;
}

/** 从页面 HTML 字符串中提取所有 .reader-line 的纯文本 */
function extractPageLines(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll(".reader-line"))
    .map((el) => el.textContent.trim())
    .filter(Boolean);
}

export function useReaderTtsManager(options: UseReaderTtsManagerOptions) {
  const {
    activeChapterIndex,
    content,
    isPagedMode: _isPagedMode,
    isScrollMode,
    isComicMode,
    isVideoMode,
    pagedPageIndex,
    activePagedPages,
    hasPrev: _hasPrev,
    hasNext,
    pagedModeRef,
    scrollModeRef,
    blockingLoading,
    setPagedPage,
    fetchRawChapterText,
    gotoNextChapter,
  } = options;

  void _hasPrev; // referenced in future: not currently used
  void _isPagedMode;

  const tts = useTts();
  const ttsCtrl = useTtsController();
  const ttsProgressText = ref("—");
  const ttsScrollHighlightIdx = ref(-1);
  const ttsScrollSentenceIdx = ref(-1);
  const isTtsSentenceActive = ref(false);
  const showTtsBar = ref(false);

  // TTS 分页模式状态（跨章节持续累计）
  let ttsPageRanges: { page: number; chapterIdx: number; start: number; end: number }[] = [];
  let ttsFeedPage = 0;
  let ttsFeedChapter = -1;

  /**
   * 等待下一章加载完成后返回。
   */
  async function gotoNextChapterAndWait(): Promise<void> {
    if (!hasNext.value) {
      return;
    }
    const targetIdx = activeChapterIndex.value + 1;
    await gotoNextChapter();
    if (blockingLoading.value) {
      await new Promise<void>((resolve) => {
        const stop = watch(
          [blockingLoading, activeChapterIndex] as const,
          ([isLoading, idx]) => {
            if (idx === targetIdx && !isLoading) {
              stop();
              resolve();
            }
          },
          { immediate: true },
        );
      });
    }
  }

  /** 构建分页模式的 TTS 启动参数 */
  function buildPagedTtsOptions() {
    const startPage = pagedPageIndex.value;
    const pages = activePagedPages.value;
    if (pages.length === 0) {
      return null;
    }

    ttsPageRanges = [];
    ttsFeedPage = startPage;
    ttsFeedChapter = activeChapterIndex.value;
    let globalIdx = 0;

    const firstLines = extractPageLines(pages[startPage] ?? "");
    if (firstLines.length > 0) {
      ttsPageRanges.push({
        page: startPage,
        chapterIdx: ttsFeedChapter,
        start: 0,
        end: firstLines.length,
      });
      globalIdx = firstLines.length;
    }

    const onNeedMore = async (): Promise<string[] | null> => {
      const nextPage = ttsFeedPage + 1;
      const currentPages = activePagedPages.value;

      if (nextPage < currentPages.length) {
        ttsFeedPage = nextPage;
        const lines = extractPageLines(currentPages[nextPage] ?? "");
        if (lines.length > 0) {
          ttsPageRanges.push({
            page: nextPage,
            chapterIdx: ttsFeedChapter,
            start: globalIdx,
            end: globalIdx + lines.length,
          });
          globalIdx += lines.length;
        }
        return lines.length > 0 ? lines : onNeedMore();
      }

      if (!hasNext.value) {
        return null;
      }
      void fetchRawChapterText(activeChapterIndex.value + 1);
      await gotoNextChapterAndWait();

      ttsFeedPage = 0;
      ttsFeedChapter = activeChapterIndex.value;
      const newPages = activePagedPages.value;
      if (newPages.length === 0) {
        return null;
      }

      const lines = extractPageLines(newPages[0] ?? "");
      if (lines.length > 0) {
        ttsPageRanges.push({
          page: 0,
          chapterIdx: ttsFeedChapter,
          start: globalIdx,
          end: globalIdx + lines.length,
        });
        globalIdx += lines.length;
      }
      return lines.length > 0 ? lines : onNeedMore();
    };

    const onSegmentStart = (gIdx: number) => {
      const range = ttsPageRanges.find((r) => gIdx >= r.start && gIdx < r.end);
      if (!range) {
        return;
      }

      const localIdx = gIdx - range.start;
      const total =
        range.chapterIdx === activeChapterIndex.value ? activePagedPages.value.length : 0;
      ttsProgressText.value =
        total > 0 ? `第 ${range.page + 1}/${total} 页` : `第 ${range.page + 1} 页`;

      if (range.chapterIdx === activeChapterIndex.value && range.page !== pagedPageIndex.value) {
        setPagedPage(range.page);
      }

      void nextTick(() => {
        pagedModeRef.value?.highlightLine?.(localIdx);
      });
    };

    return {
      initialSegments: firstLines,
      onNeedMore,
      onSegmentStart,
      onAllDone: () => {
        showTtsBar.value = false;
      },
    };
  }

  /** 启动滚动模式的句子级 TTS（使用 useTtsController） */
  function startScrollTtsWithController(): boolean {
    const text = content.value;
    const startIdx = activeChapterIndex.value;

    ttsCtrl.setCallbacks({
      onSentenceChange: (sentenceIdx: number) => {
        ttsScrollSentenceIdx.value = sentenceIdx;
        const paraIdx = findParagraphForSentence(sentenceIdx);
        if (paraIdx >= 0) {
          ttsScrollHighlightIdx.value = paraIdx;
        }
        ttsProgressText.value = `第 ${sentenceIdx + 1} 句`;
      },
      onChapterEnd: () => {
        // handled by chapterProvider
      },
      onAllDone: () => {
        isTtsSentenceActive.value = false;
        showTtsBar.value = false;
        ttsScrollSentenceIdx.value = -1;
        ttsScrollHighlightIdx.value = -1;
      },
    });

    ttsCtrl.setChapterProvider(async (currentKey) => {
      if (!hasNext.value) return null;
      void fetchRawChapterText(activeChapterIndex.value + 1);
      await gotoNextChapterAndWait();
      return {
        text: content.value,
        key: activeChapterIndex.value,
        hasMore: hasNext.value,
      };
    });

    ttsCtrl.start(text, startIdx);
    isTtsSentenceActive.value = true;
    return true;
  }

  function findParagraphForSentence(sentenceIdx: number): number {
    const paragraphs = content.value.split(/\n+/).filter((p) => p.trim());
    let globalCount = 0;
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const sents = splitIntoSentences(paragraphs[pi] ?? "");
      if (sentenceIdx < globalCount + sents.length) {
        return pi;
      }
      globalCount += sents.length;
    }
    return -1;
  }

  function onTtsToggle() {
    if (showTtsBar.value) {
      showTtsBar.value = false;
      tts.stop();
      ttsCtrl.stop();
      return;
    }

    if (isComicMode.value || isVideoMode.value) {
      return;
    }

    if (isScrollMode.value) {
      if (!startScrollTtsWithController()) {
        return;
      }
    } else {
      const opts = buildPagedTtsOptions();
      if (!opts) {
        return;
      }
      tts.startReading(opts);
    }

    showTtsBar.value = true;
    ttsProgressText.value = "—";
  }

  // TTS 控制条关闭时停止播放 + 清除高亮
  watch(
    () => showTtsBar.value,
    (v) => {
      if (!v) {
        tts.stop();
        ttsCtrl.stop();
        isTtsSentenceActive.value = false;
        ttsScrollHighlightIdx.value = -1;
        ttsScrollSentenceIdx.value = -1;
        pagedModeRef.value?.clearTtsHighlight?.();
        ttsProgressText.value = "—";
      }
    },
  );

  // 章节切换时如果 TTS 未在播放，清理遗留状态
  watch(activeChapterIndex, () => {
    if (!showTtsBar.value) {
      tts.stop();
      ttsCtrl.stop();
      isTtsSentenceActive.value = false;
      ttsScrollHighlightIdx.value = -1;
      ttsScrollSentenceIdx.value = -1;
    }
  });

  return {
    tts,
    ttsProgressText,
    ttsScrollHighlightIdx,
    ttsScrollSentenceIdx,
    isTtsSentenceActive,
    showTtsBar,
    onTtsToggle,
  };
}
