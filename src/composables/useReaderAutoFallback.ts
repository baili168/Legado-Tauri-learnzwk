import type { BookItem, BookSourceMeta, ChapterItem } from "@/types";
import { listBookSources } from "@/composables/useBookSource";

type RunChapterContentFn = (
  fileName: string,
  chapterUrl: string,
  sourceDir?: string,
  categoryParams?: Record<string, string>,
) => Promise<unknown>;

type RunSearchFn = (
  fileName: string,
  keyword: string,
  page: number,
  sourceDir?: string,
) => Promise<unknown>;

type RunBookInfoFn = (
  fileName: string,
  bookUrl: string,
  sourceDir?: string,
) => Promise<unknown>;

type RunChapterListFn = (
  fileName: string,
  tocUrl: string,
  sourceDir?: string,
) => Promise<unknown>;

let _sourcesCache: BookSourceMeta[] | null = null;
let _sourcesCacheTime = 0;

async function getAvailableSources(
  currentFileName: string,
  sourceType: string,
): Promise<BookSourceMeta[]> {
  if (!_sourcesCache || Date.now() - _sourcesCacheTime > 30000) {
    _sourcesCache = await listBookSources();
    _sourcesCacheTime = Date.now();
  }
  return _sourcesCache.filter(
    (s) =>
      s.enabled &&
      s.fileName !== currentFileName &&
      (s.sourceType === sourceType || sourceType === "novel"),
  );
}

export interface AutoFallbackContext {
  bookName: string;
  bookAuthor?: string;
  chapterTitle: string;
  currentFileName: string;
  sourceType: string;
  onFallbackSuccess?: (sourceName: string) => void;
}

export async function tryAutoFallback(
  ctx: AutoFallbackContext,
  runSearch: RunSearchFn,
  runBookInfo: RunBookInfoFn,
  runChapterList: RunChapterListFn,
  runChapterContent: RunChapterContentFn,
): Promise<string | null> {
  const sources = await getAvailableSources(ctx.currentFileName, ctx.sourceType);
  if (!sources.length) {
    return null;
  }

  const searchKeyword = ctx.bookName;
  const candidates: Array<{
    source: BookSourceMeta;
    book: BookItem;
    score: number;
  }> = [];

  for (const source of sources) {
    try {
      const raw = await runSearch(source.fileName, searchKeyword, 1, source.sourceDir);
      const list = Array.isArray(raw) ? (raw as BookItem[]) : [];
      for (const book of list) {
        let score = 0;
        if (book.name?.trim() === ctx.bookName?.trim()) {
          score += 60;
        }
        if (
          ctx.bookAuthor &&
          book.author?.trim() &&
          ctx.bookAuthor.trim() === book.author.trim()
        ) {
          score += 28;
        }
        if (score >= 30) {
          candidates.push({ source, book, score });
        }
      }
    } catch {
      // skip failed source
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  for (const candidate of candidates.slice(0, 3)) {
    try {
      const detail = (await runBookInfo(
        candidate.source.fileName,
        candidate.book.bookUrl,
        candidate.source.sourceDir,
      )) as { tocUrl?: string } | undefined;

      const tocUrl = detail?.tocUrl ?? candidate.book.bookUrl;
      const rawChapters = await runChapterList(
        candidate.source.fileName,
        tocUrl,
        candidate.source.sourceDir,
      );

      const chapters = Array.isArray(rawChapters) ? (rawChapters as ChapterItem[]) : [];
      const match = findChapterMatch(ctx.chapterTitle, chapters);

      if (match) {
        const content = await runChapterContent(
          candidate.source.fileName,
          match.url,
          candidate.source.sourceDir,
        );
        const text = typeof content === "string" ? content : String(content ?? "");
        if (text) {
          ctx.onFallbackSuccess?.(candidate.source.name);
          return text;
        }
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

function findChapterMatch(
  targetTitle: string,
  chapters: ChapterItem[],
): ChapterItem | null {
  if (!targetTitle || !chapters.length) {
    return null;
  }

  const normalized = targetTitle.trim();
  for (const ch of chapters) {
    if (ch.name.trim() === normalized) {
      return ch;
    }
  }

  let bestMatch: ChapterItem | null = null;
  let bestScore = 0;
  for (const ch of chapters) {
    const similarity = stringSimilarity(normalized, ch.name.trim());
    if (similarity > bestScore && similarity > 0.6) {
      bestScore = similarity;
      bestMatch = ch;
    }
  }

  return bestMatch;
}

function stringSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  if (lenA === 0 || lenB === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[lenA][lenB];
  return 1 - distance / Math.max(lenA, lenB);
}