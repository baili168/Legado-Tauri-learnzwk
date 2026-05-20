/**
 * useSmartSourceDetector — 智能源识别系统
 *
 * 通过 Rust 后端分析目标网站 HTML 结构，自动提取 CSS 选择器，
 * 识别广告元素，并生成对应类型的 legado 书源 JS 代码。
 *
 * 支持四种内容类型：
 *   - novel（小说） — 生成含 search/bookInfo/toc/content 的完整书源
 *   - comic（漫画）  — content() 返回图片 URL 数组
 *   - video（视频）  — content() 返回 JSON 格式播放地址
 *   - audio（音频）  — content() 返回 JSON 格式音频地址
 */

import { computed, reactive, readonly, shallowRef } from 'vue'
import { invokeWithTimeout } from './useInvoke'
import { toSafeFileName } from './useBookSource'

// ── 类型定义 ──────────────────────────────────────────────────────────────

export type AnalysisProgress = {
  stage: 'connecting' | 'loading' | 'parsing' | 'classifying' | 'filtering' | 'extracting' | 'generating' | 'done'
  message: string
}

export type ContentType = 'novel' | 'comic' | 'video' | 'audio' | 'unknown'

export type AdElement = {
  selector: string
  reason: string
  elementType: string
}

export type ExtractedSelector = {
  purpose: 'search' | 'bookList' | 'bookItem' | 'toc' | 'content' | 'title' | 'author' | 'cover' | 'chapterName' | 'chapterUrl'
  selector: string
  confidence: number
}

export type AnalysisResult = {
  url: string
  contentType: ContentType
  confidence: number
  siteName: string
  selectors: ExtractedSelector[]
  adElements: AdElement[]
  sampleResults?: AnalysisResult[]
}

export type SmartSourceState = {
  url: string
  sampleUrls: string[]
  progress: AnalysisProgress | null
  result: AnalysisResult | null
  generatedCode: string
  isAnalyzing: boolean
  generatedFileName: string
}

// ── 广告过滤规则引擎 ───────────────────────────────────────────────────────

const AD_KEYWORDS_CN: string[] = [
  '广告', '推广', '赞助', '推荐', '猜你喜欢', '热门推荐', '相关阅读',
  '大家都在看', '热门搜索', '促销', '优惠', '秒杀', '打折', '限时',
  '弹窗', '浮层', '横幅', '悬浮', '飘窗', '公告',
]

const AD_KEYWORDS_EN: string[] = [
  'ad', 'ads', 'advertisement', 'banner', 'popup', 'sponsor', 'promo',
  'promotion', 'ggh', 'adv', 'adslot', 'adframe', 'adsense', 'dfp',
  'doubleclick', 'advert', 'social-share', 'sharing',
]

const AD_CLASS_PATTERNS: RegExp[] = [
  /(^|[-_\s])(ad|ads|advert|banner|popup|sponsor|promo|ggh)([-_\s]|$)/i,
  /(^|[-_\s])(gg|guanggao|tui[gj]ian|zanzhu)([-_\s]|$)/i,
]

const AD_ID_PATTERNS: RegExp[] = [
  /^(ad|ads|banner|popup|sponsor|promo)/i,
  /^(gg|guanggao)/i,
]

const AD_TAG_PATTERNS: RegExp[] = [
  /^iframe$/i,
  /^ins$/i,
]

export const AD_FILTER_RULES = {
  keywordsCn: AD_KEYWORDS_CN,
  keywordsEn: AD_KEYWORDS_EN,
  classPatterns: AD_CLASS_PATTERNS,
  idPatterns: AD_ID_PATTERNS,
  tagPatterns: AD_TAG_PATTERNS,

  matchText(text: string): boolean {
    if (!text) return false
    const lower = text.toLowerCase()
    return (
      AD_KEYWORDS_CN.some((kw) => text.includes(kw)) ||
      AD_KEYWORDS_EN.some((kw) => lower.includes(kw))
    )
  },

  matchClassName(className: string): boolean {
    if (!className) return false
    return AD_CLASS_PATTERNS.some((p) => p.test(className))
  },

  matchElementId(id: string): boolean {
    if (!id) return false
    return AD_ID_PATTERNS.some((p) => p.test(id))
  },

  matchTagName(tagName: string): boolean {
    if (!tagName) return false
    return AD_TAG_PATTERNS.some((p) => p.test(tagName))
  },

  isLikelyAd(selector: string, textContent: string, className: string, id: string, tagName: string): boolean {
    return (
      this.matchText(textContent) ||
      this.matchClassName(className) ||
      this.matchElementId(id) ||
      this.matchTagName(tagName) ||
      AD_KEYWORDS_CN.some((kw) => selector.toLowerCase().includes(kw.toLowerCase())) ||
      AD_KEYWORDS_EN.some((kw) => selector.toLowerCase().includes(kw.toLowerCase()))
    )
  },
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────

function findSelectorByPurpose(
  selectors: ExtractedSelector[],
  purpose: ExtractedSelector['purpose'],
): ExtractedSelector | undefined {
  return selectors
    .filter((s) => s.purpose === purpose)
    .sort((a, b) => b.confidence - a.confidence)[0]
}

function escapeJsString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

function buildUrlFromDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + '/'
  } catch {
    return url
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function extractSiteName(url: string): string {
  const domain = extractDomain(url)
  return domain.replace(/^www\./, '').split('.')[0] || domain
}

// ── 小说书源代码生成 ─────────────────────────────────────────────────────

export function generateNovelSource(result: AnalysisResult): string {
  const baseUrl = buildUrlFromDomain(result.url)
  const siteName = result.siteName || extractSiteName(result.url)
  const version = '1.0.0'
  const tagList = '智能识别,小说,免费'

  const bookListSel = findSelectorByPurpose(result.selectors, 'bookList')
  const bookItemSel = findSelectorByPurpose(result.selectors, 'bookItem')
  const tocSel = findSelectorByPurpose(result.selectors, 'toc')
  const contentSel = findSelectorByPurpose(result.selectors, 'content')
  const titleSel = findSelectorByPurpose(result.selectors, 'title')
  const authorSel = findSelectorByPurpose(result.selectors, 'author')
  const coverSel = findSelectorByPurpose(result.selectors, 'cover')
  const chapterNameSel = findSelectorByPurpose(result.selectors, 'chapterName')
  const chapterUrlSel = findSelectorByPurpose(result.selectors, 'chapterUrl')

  const chapterUrlItemSel = chapterUrlSel?.selector || 'a'

  const bookListItemSel = bookItemSel?.selector || bookListSel?.selector || '.result-item, .book-list li, .novel-list li, .search-list li'
  const tocItemSel = chapterNameSel?.selector || tocSel?.selector || '#list dd, #chapterlist dd, .chapter-list li, #ul_all_chapters li'
  const contentContainerSel = contentSel?.selector || '#content, #chaptercontent, .content, .chapter-content, #articlecontent, .txt, #htmlContent'
  const titleItemSel = titleSel?.selector || 'h1, .title, .book-title, [property="og:title"]'
  const authorItemSel = authorSel?.selector || '.author, .book-author, [property="og:novel:author"]'
  const coverItemSel = coverSel?.selector || '.cover img, .book-cover img, [property="og:image"]'

  const adSelectors = result.adElements.map((a) => a.selector).join(', ')

  return `// @name        ${siteName}
// @version     ${version}
// @author      Legado 智能识别
// @type        novel
// @url         ${baseUrl}
// @logo        default
// @enabled     true
// @tags        ${tagList}
// @description 自动生成：${siteName} 小说书源

var BASE_URL = '${escapeJsString(baseUrl)}';
var SEARCH_URL = '${escapeJsString(baseUrl)}search/?searchkey=';

// ── 搜索 ─────────────────────────────────────────────────────
// 返回 BookItem[]
async function search(key, page) {
  var encodeKey = legado.urlEncodeCharset(key, 'GBK');
  var searchUrl = SEARCH_URL + encodeKey;
  if (page && page > 1) {
    searchUrl = searchUrl + '&page=' + page;
  }
  legado.log('[${siteName}] 搜索关键词: ' + key + ' 第' + page + '页');
  var html = await legado.http.get(searchUrl);
  var doc = legado.dom.parse(html);
  ${adSelectors ? `// 移除广告元素\n  legado.dom.cs(doc, '${escapeJsString(adSelectors)}');` : '  // 未检测到广告元素'}
  var items = legado.dom.cs(doc, '${escapeJsString(bookListItemSel)}');
  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var titleEl = legado.dom.cs(item, '${escapeJsString(titleItemSel)}');
    var authorEl = legado.dom.cs(item, '${escapeJsString(authorItemSel)}');
    var coverEl = legado.dom.cs(item, '${escapeJsString(coverItemSel)}');
    var linkEl = legado.dom.cs(item, '${escapeJsString(chapterUrlItemSel)}');
    var name = titleEl ? legado.dom.text(titleEl) : '';
    var author = authorEl ? legado.dom.text(authorEl) : '';
    var coverUrl = coverEl ? legado.dom.attr(coverEl, 'src') : '';
    var bookUrl = linkEl ? legado.dom.attr(linkEl, 'href') : '';
    if (bookUrl && bookUrl.indexOf('http') !== 0) {
      bookUrl = BASE_URL + bookUrl.replace(/^\\//, '');
    }
    if (coverUrl && coverUrl.indexOf('http') !== 0) {
      coverUrl = BASE_URL + coverUrl.replace(/^\\//, '');
    }
    if (name && bookUrl) {
      results.push({
        name: name.trim(),
        author: author.trim(),
        coverUrl: coverUrl,
        bookUrl: bookUrl,
      });
    }
  }
  legado.log('[${siteName}] 搜索结果: ' + results.length + ' 条');
  return results;
}

// ── 书籍详情 ──────────────────────────────────────────────────
// 返回 BookItem（含 tocUrl）
async function bookInfo(bookUrl) {
  legado.log('[${siteName}] 获取书籍详情: ' + bookUrl);
  var html = await legado.http.get(bookUrl);
  var doc = legado.dom.parse(html);
  ${adSelectors ? `legado.dom.cs(doc, '${escapeJsString(adSelectors)}');` : ''}
  var titleEl = legado.dom.cs(doc, '${escapeJsString(titleItemSel)}');
  var authorEl = legado.dom.cs(doc, '${escapeJsString(authorItemSel)}');
  var coverEl = legado.dom.cs(doc, '${escapeJsString(coverItemSel)}');
  var name = titleEl ? legado.dom.text(titleEl) : '';
  var author = authorEl ? legado.dom.text(authorEl) : '';
  var coverUrl = coverEl ? legado.dom.attr(coverEl, 'src') : '';
  if (coverUrl && coverUrl.indexOf('http') !== 0) {
    coverUrl = BASE_URL + coverUrl.replace(/^\\//, '');
  }
  return {
    name: name.trim(),
    author: author.trim(),
    coverUrl: coverUrl,
    bookUrl: bookUrl,
    tocUrl: bookUrl,
  };
}

// ── 章节目录 ──────────────────────────────────────────────────
// 返回 ChapterInfo[]
async function toc(tocUrl) {
  legado.log('[${siteName}] 获取章节目录: ' + tocUrl);
  var html = await legado.http.get(tocUrl);
  var doc = legado.dom.parse(html);
  ${adSelectors ? `legado.dom.cs(doc, '${escapeJsString(adSelectors)}');` : ''}
  var items = legado.dom.cs(doc, '${escapeJsString(tocItemSel)}');
  var chapters = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var linkEl = legado.dom.cs(item, '${escapeJsString(chapterUrlItemSel)}');
    if (!linkEl) {
      linkEl = item;
    }
    var name = legado.dom.text(linkEl) || legado.dom.text(item);
    var url = legado.dom.attr(linkEl, 'href') || '';
    if (url && url.indexOf('http') !== 0) {
      url = BASE_URL + url.replace(/^\\//, '');
    }
    if (name && url) {
      chapters.push({
        name: name.trim(),
        url: url,
      });
    }
  }
  legado.log('[${siteName}] 章节数量: ' + chapters.length);
  return chapters;
}

// ── 章节正文 ──────────────────────────────────────────────────
// 返回纯文本字符串
async function content(chapterUrl) {
  legado.log('[${siteName}] 获取章节正文: ' + chapterUrl);
  var html = await legado.http.get(chapterUrl);
  var doc = legado.dom.parse(html);
  ${adSelectors ? `legado.dom.cs(doc, '${escapeJsString(adSelectors)}');` : ''}
  var contentEl = legado.dom.cs(doc, '${escapeJsString(contentContainerSel)}');
  if (!contentEl) {
    legado.log('[${siteName}] 未找到正文容器，使用 body');
    contentEl = doc;
  }
  var text = legado.dom.text(contentEl);
  text = text.replace(/[\\s]{2,}/g, '\\n\\n');
  text = text.replace(/[\\t]+/g, '');
  return text;
}

// ── 发现页（可选） ────────────────────────────────────────────
// 返回 ExploreItem[]，不需要时可删除此函数
// async function explore(page, category) { ... }
`
}

// ── 视频书源代码生成 ─────────────────────────────────────────────────────

export function generateVideoSource(result: AnalysisResult): string {
  const baseUrl = buildUrlFromDomain(result.url)
  const siteName = result.siteName || extractSiteName(result.url)
  const version = '1.0.0'
  const tagList = '智能识别,视频,影视'

  const bookItemSel = findSelectorByPurpose(result.selectors, 'bookItem')
  const titleSel = findSelectorByPurpose(result.selectors, 'title')
  const coverSel = findSelectorByPurpose(result.selectors, 'cover')
  const contentSel = findSelectorByPurpose(result.selectors, 'content')

  const videoItemSel = bookItemSel?.selector || '.video-item, .movie-item, .video-list li, .module-item'
  const titleItemSel = titleSel?.selector || 'h1, .title, .video-title, [property="og:title"]'
  const coverItemSel = coverSel?.selector || '.cover img, .video-cover img, [property="og:image"]'
  const contentElSel = contentSel?.selector || 'video source, iframe[src*=".mp4"], [data-video]'

  const scopeName = siteName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')

  return `// @name        ${siteName}
// @version     ${version}
// @author      Legado 智能识别
// @type        video
// @url         ${baseUrl}
// @logo        default
// @enabled     true
// @tags        ${tagList}
// @description 自动生成：${siteName} 视频书源

// ─────────────────────────────────────────────────────────────
//  视频书源 — content() 返回 JSON 字符串格式的播放地址
//
//  content() 返回值示例：
//    {
//      "url": "https://example.com/video.mp4",
//      "type": "mp4",
//      "headers": { "Referer": "${baseUrl}" }
//    }
// ─────────────────────────────────────────────────────────────
var BASE_URL = '${escapeJsString(baseUrl)}';
var SCOPE = '${escapeJsString(scopeName)}';

// ── 搜索 ─────────────────────────────────────────────────────
async function search(key, page) {
  legado.log('[${siteName}] 搜索: ' + key);
  var encodeKey = encodeURIComponent(key);
  var html = await legado.http.get(
    BASE_URL + 'search/?keyword=' + encodeKey + (page ? '&page=' + page : '')
  );
  var doc = legado.dom.parse(html);
  var items = legado.dom.cs(doc, '${escapeJsString(videoItemSel)}');
  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var titleEl = legado.dom.cs(item, '${escapeJsString(titleItemSel)}');
    var coverEl = legado.dom.cs(item, '${escapeJsString(coverItemSel)}');
    var linkEl = legado.dom.cs(item, 'a');
    var name = titleEl ? legado.dom.text(titleEl) : '';
    var coverUrl = coverEl ? legado.dom.attr(coverEl, 'src') : '';
    var bookUrl = linkEl ? legado.dom.attr(linkEl, 'href') : '';
    if (bookUrl && bookUrl.indexOf('http') !== 0) {
      bookUrl = BASE_URL + bookUrl.replace(/^\\//, '');
    }
    if (coverUrl && coverUrl.indexOf('http') !== 0) {
      coverUrl = BASE_URL + coverUrl.replace(/^\\//, '');
    }
    if (name && bookUrl) {
      results.push({
        name: name.trim(),
        author: '',
        coverUrl: coverUrl,
        bookUrl: bookUrl,
        kind: 'video',
      });
    }
  }
  return results;
}

// ── 书籍详情 ──────────────────────────────────────────────────
async function bookInfo(bookUrl) {
  legado.log('[${siteName}] 获取详情: ' + bookUrl);
  var html = await legado.http.get(bookUrl);
  var doc = legado.dom.parse(html);
  var titleEl = legado.dom.cs(doc, '${escapeJsString(titleItemSel)}');
  var coverEl = legado.dom.cs(doc, '${escapeJsString(coverItemSel)}');
  return {
    name: titleEl ? legado.dom.text(titleEl).trim() : '',
    author: '',
    coverUrl: coverEl ? legado.dom.attr(coverEl, 'src') : '',
    bookUrl: bookUrl,
    tocUrl: bookUrl,
  };
}

// ── 剧集列表 ──────────────────────────────────────────────────
async function toc(tocUrl) {
  legado.log('[${siteName}] 获取剧集: ' + tocUrl);
  var html = await legado.http.get(tocUrl);
  var doc = legado.dom.parse(html);
  var items = legado.dom.cs(doc, '.episode-item, .play-list li, .module-play-list a');
  var chapters = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var linkEl = legado.dom.cs(item, 'a');
    if (!linkEl) linkEl = item;
    var name = legado.dom.text(linkEl);
    var url = legado.dom.attr(linkEl, 'href') || '';
    if (url && url.indexOf('http') !== 0) {
      url = BASE_URL + url.replace(/^\\//, '');
    }
    if (name && url) {
      chapters.push({ name: name.trim(), url: url });
    }
  }
  return chapters;
}

// ── 播放地址 ──────────────────────────────────────────────────
async function content(chapterUrl) {
  legado.log('[${siteName}] 获取播放地址: ' + chapterUrl);
  var html = await legado.http.get(chapterUrl);
  var doc = legado.dom.parse(html);
  var videoEl = legado.dom.cs(doc, '${escapeJsString(contentElSel)}');
  var videoUrl = '';
  if (videoEl) {
    videoUrl = legado.dom.attr(videoEl, 'src') || legado.dom.attr(videoEl, 'data-video') || '';
  }
  if (!videoUrl) {
    var iframeEl = legado.dom.cs(doc, 'iframe');
    if (iframeEl) {
      videoUrl = legado.dom.attr(iframeEl, 'src') || '';
    }
  }
  return JSON.stringify({
    url: videoUrl,
    type: 'mp4',
    headers: { Referer: BASE_URL },
  });
}

// ── 发现页（可选） ────────────────────────────────────────────
// async function explore(page, category) { ... }
`
}

// ── 漫画书源代码生成 ─────────────────────────────────────────────────────

export function generateComicSource(result: AnalysisResult): string {
  const baseUrl = buildUrlFromDomain(result.url)
  const siteName = result.siteName || extractSiteName(result.url)
  const version = '1.0.0'
  const tagList = '智能识别,漫画,图片'

  const bookItemSel = findSelectorByPurpose(result.selectors, 'bookItem')
  const titleSel = findSelectorByPurpose(result.selectors, 'title')
  const coverSel = findSelectorByPurpose(result.selectors, 'cover')
  const contentSel = findSelectorByPurpose(result.selectors, 'content')
  const chapterNameSel = findSelectorByPurpose(result.selectors, 'chapterName')
  const tocSel = findSelectorByPurpose(result.selectors, 'toc')

  const comicItemSel = bookItemSel?.selector || '.comic-item, .cartoon-item, .manga-list li, .comic-list li'
  const titleItemSel = titleSel?.selector || 'h1, .title, .comic-title'
  const coverItemSel = coverSel?.selector || '.cover img, .comic-cover img, img.cover'
  const tocItemSel = chapterNameSel?.selector || tocSel?.selector || '.chapter-list li, #chapterlist li, .comic-chapter a'
  const contentElSel = contentSel?.selector || '.comic-content img, .chapter-img img, .manga-page img, #chapterArea img'

  return `// @name        ${siteName}
// @version     ${version}
// @author      Legado 智能识别
// @type        comic
// @url         ${baseUrl}
// @logo        default
// @enabled     true
// @tags        ${tagList}
// @description 自动生成：${siteName} 漫画书源

var BASE_URL = '${escapeJsString(baseUrl)}';

// ── 搜索 ─────────────────────────────────────────────────────
async function search(key, page) {
  legado.log('[${siteName}] 搜索: ' + key);
  var encodeKey = encodeURIComponent(key);
  var html = await legado.http.get(
    BASE_URL + 'search/?keyword=' + encodeKey + (page ? '&page=' + page : '')
  );
  var doc = legado.dom.parse(html);
  var items = legado.dom.cs(doc, '${escapeJsString(comicItemSel)}');
  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var titleEl = legado.dom.cs(item, '${escapeJsString(titleItemSel)}');
    var coverEl = legado.dom.cs(item, '${escapeJsString(coverItemSel)}');
    var linkEl = legado.dom.cs(item, 'a');
    var name = titleEl ? legado.dom.text(titleEl) : '';
    var coverUrl = coverEl ? legado.dom.attr(coverEl, 'src') || legado.dom.attr(coverEl, 'data-src') : '';
    var bookUrl = linkEl ? legado.dom.attr(linkEl, 'href') : '';
    if (bookUrl && bookUrl.indexOf('http') !== 0) {
      bookUrl = BASE_URL + bookUrl.replace(/^\\//, '');
    }
    if (coverUrl && coverUrl.indexOf('http') !== 0) {
      if (coverUrl.indexOf('//') === 0) {
        coverUrl = 'https:' + coverUrl;
      } else {
        coverUrl = BASE_URL + coverUrl.replace(/^\\//, '');
      }
    }
    if (name && bookUrl) {
      results.push({
        name: name.trim(),
        author: '',
        coverUrl: coverUrl,
        bookUrl: bookUrl,
        kind: 'comic',
      });
    }
  }
  return results;
}

// ── 书籍详情 ──────────────────────────────────────────────────
async function bookInfo(bookUrl) {
  legado.log('[${siteName}] 获取详情: ' + bookUrl);
  var html = await legado.http.get(bookUrl);
  var doc = legado.dom.parse(html);
  var titleEl = legado.dom.cs(doc, '${escapeJsString(titleItemSel)}');
  var coverEl = legado.dom.cs(doc, '${escapeJsString(coverItemSel)}');
  var name = titleEl ? legado.dom.text(titleEl) : '';
  var coverUrl = coverEl ? (legado.dom.attr(coverEl, 'src') || legado.dom.attr(coverEl, 'data-src')) : '';
  if (coverUrl && coverUrl.indexOf('http') !== 0) {
    if (coverUrl.indexOf('//') === 0) {
      coverUrl = 'https:' + coverUrl;
    } else {
      coverUrl = BASE_URL + coverUrl.replace(/^\\//, '');
    }
  }
  return {
    name: name.trim(),
    author: '',
    coverUrl: coverUrl,
    bookUrl: bookUrl,
    tocUrl: bookUrl,
  };
}

// ── 章节目录 ──────────────────────────────────────────────────
async function toc(tocUrl) {
  legado.log('[${siteName}] 获取目录: ' + tocUrl);
  var html = await legado.http.get(tocUrl);
  var doc = legado.dom.parse(html);
  var items = legado.dom.cs(doc, '${escapeJsString(tocItemSel)}');
  var chapters = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var linkEl = legado.dom.cs(item, 'a');
    if (!linkEl) linkEl = item;
    var name = legado.dom.text(linkEl);
    var url = legado.dom.attr(linkEl, 'href') || '';
    if (url && url.indexOf('http') !== 0) {
      url = BASE_URL + url.replace(/^\\//, '');
    }
    if (name && url) {
      chapters.push({ name: name.trim(), url: url });
    }
  }
  return chapters;
}

// ── 章节正文（返回图片 URL 数组） ────────────────────────────
// 返回 JSON.stringify(imageUrls)
async function content(chapterUrl) {
  legado.log('[${siteName}] 获取漫画图片: ' + chapterUrl);
  var html = await legado.http.get(chapterUrl);
  var doc = legado.dom.parse(html);
  var imgEls = legado.dom.cs(doc, '${escapeJsString(contentElSel)}');
  var images = [];
  for (var i = 0; i < imgEls.length; i++) {
    var img = imgEls[i];
    var src = legado.dom.attr(img, 'src') || legado.dom.attr(img, 'data-src') || legado.dom.attr(img, 'data-original') || '';
    if (src) {
      if (src.indexOf('http') !== 0) {
        if (src.indexOf('//') === 0) {
          src = 'https:' + src;
        } else {
          src = BASE_URL + src.replace(/^\\//, '');
        }
      }
      images.push(src);
    }
  }
  legado.log('[${siteName}] 图片数量: ' + images.length);
  return JSON.stringify(images);
}

// ── 发现页（可选） ────────────────────────────────────────────
// async function explore(page, category) { ... }
`
}

// ── 音频书源代码生成 ─────────────────────────────────────────────────────

export function generateAudioSource(result: AnalysisResult): string {
  const baseUrl = buildUrlFromDomain(result.url)
  const siteName = result.siteName || extractSiteName(result.url)
  const version = '1.0.0'
  const tagList = '智能识别,音频,有声书'

  const bookItemSel = findSelectorByPurpose(result.selectors, 'bookItem')
  const titleSel = findSelectorByPurpose(result.selectors, 'title')
  const coverSel = findSelectorByPurpose(result.selectors, 'cover')
  const contentSel = findSelectorByPurpose(result.selectors, 'content')
  const chapterNameSel = findSelectorByPurpose(result.selectors, 'chapterName')
  const tocSel = findSelectorByPurpose(result.selectors, 'toc')

  const audioItemSel = bookItemSel?.selector || '.audio-item, .album-item, .music-list li, .sound-list li'
  const titleItemSel = titleSel?.selector || 'h1, .title, .audio-title'
  const coverItemSel = coverSel?.selector || '.cover img, .album-cover img, img.cover'
  const tocItemSel = chapterNameSel?.selector || tocSel?.selector || '.episode-list li, .track-list li, #playlist li'
  const contentElSel = contentSel?.selector || 'audio source, audio[src], [data-audio]'

  return `// @name        ${siteName}
// @version     ${version}
// @author      Legado 智能识别
// @type        music
// @url         ${baseUrl}
// @logo        default
// @enabled     true
// @tags        ${tagList}
// @description 自动生成：${siteName} 音频书源

var BASE_URL = '${escapeJsString(baseUrl)}';

// ── 搜索 ─────────────────────────────────────────────────────
async function search(key, page) {
  legado.log('[${siteName}] 搜索: ' + key);
  var encodeKey = encodeURIComponent(key);
  var html = await legado.http.get(
    BASE_URL + 'search/?keyword=' + encodeKey + (page ? '&page=' + page : '')
  );
  var doc = legado.dom.parse(html);
  var items = legado.dom.cs(doc, '${escapeJsString(audioItemSel)}');
  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var titleEl = legado.dom.cs(item, '${escapeJsString(titleItemSel)}');
    var coverEl = legado.dom.cs(item, '${escapeJsString(coverItemSel)}');
    var linkEl = legado.dom.cs(item, 'a');
    var name = titleEl ? legado.dom.text(titleEl) : '';
    var coverUrl = coverEl ? legado.dom.attr(coverEl, 'src') : '';
    var bookUrl = linkEl ? legado.dom.attr(linkEl, 'href') : '';
    if (bookUrl && bookUrl.indexOf('http') !== 0) {
      bookUrl = BASE_URL + bookUrl.replace(/^\\//, '');
    }
    if (coverUrl && coverUrl.indexOf('http') !== 0) {
      coverUrl = BASE_URL + coverUrl.replace(/^\\//, '');
    }
    if (name && bookUrl) {
      results.push({
        name: name.trim(),
        author: '',
        coverUrl: coverUrl,
        bookUrl: bookUrl,
        kind: 'audio',
      });
    }
  }
  return results;
}

// ── 书籍详情 ──────────────────────────────────────────────────
async function bookInfo(bookUrl) {
  legado.log('[${siteName}] 获取详情: ' + bookUrl);
  var html = await legado.http.get(bookUrl);
  var doc = legado.dom.parse(html);
  var titleEl = legado.dom.cs(doc, '${escapeJsString(titleItemSel)}');
  var coverEl = legado.dom.cs(doc, '${escapeJsString(coverItemSel)}');
  return {
    name: titleEl ? legado.dom.text(titleEl).trim() : '',
    author: '',
    coverUrl: coverEl ? legado.dom.attr(coverEl, 'src') : '',
    bookUrl: bookUrl,
    tocUrl: bookUrl,
  };
}

// ── 节目列表 ──────────────────────────────────────────────────
async function toc(tocUrl) {
  legado.log('[${siteName}] 获取节目列表: ' + tocUrl);
  var html = await legado.http.get(tocUrl);
  var doc = legado.dom.parse(html);
  var items = legado.dom.cs(doc, '${escapeJsString(tocItemSel)}');
  var chapters = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var linkEl = legado.dom.cs(item, 'a');
    if (!linkEl) linkEl = item;
    var name = legado.dom.text(linkEl);
    var url = legado.dom.attr(linkEl, 'href') || '';
    if (url && url.indexOf('http') !== 0) {
      url = BASE_URL + url.replace(/^\\//, '');
    }
    if (name && url) {
      chapters.push({ name: name.trim(), url: url });
    }
  }
  return chapters;
}

// ── 获取音频地址 ──────────────────────────────────────────────
// 返回 JSON.stringify({ url, type, headers })
async function content(chapterUrl) {
  legado.log('[${siteName}] 获取音频地址: ' + chapterUrl);
  var html = await legado.http.get(chapterUrl);
  var doc = legado.dom.parse(html);
  var audioEl = legado.dom.cs(doc, '${escapeJsString(contentElSel)}');
  var audioUrl = '';
  if (audioEl) {
    audioUrl = legado.dom.attr(audioEl, 'src') || legado.dom.attr(audioEl, 'data-audio') || '';
  }
  if (!audioUrl) {
    var sourceEl = legado.dom.cs(doc, 'source');
    if (sourceEl) {
      audioUrl = legado.dom.attr(sourceEl, 'src') || '';
    }
  }
  return JSON.stringify({
    url: audioUrl,
    type: 'mp3',
    headers: { Referer: BASE_URL },
  });
}

// ── 发现页（可选） ────────────────────────────────────────────
// async function explore(page, category) { ... }
`
}

// ── 代码生成调度 ─────────────────────────────────────────────────────────

export function generateSourceCode(result: AnalysisResult): { code: string; fileName: string } {
  const siteName = result.siteName || extractSiteName(result.url)
  const fileName = toSafeFileName(siteName.replace(/\.js$/, ''))

  let code: string

  switch (result.contentType) {
    case 'novel':
      code = generateNovelSource(result)
      break
    case 'comic':
      code = generateComicSource(result)
      break
    case 'video':
      code = generateVideoSource(result)
      break
    case 'audio':
      code = generateAudioSource(result)
      break
    default:
      code = generateNovelSource({
        ...result,
        contentType: 'novel',
      })
      break
  }

  return { code, fileName }
}

// ── 模拟分析结果（后端不可用时的降级方案） ─────────────────────────────

function buildMockAnalysisResult(url: string): AnalysisResult {
  const siteName = extractSiteName(url)
  const baseUrl = buildUrlFromDomain(url)

  return {
    url: baseUrl,
    contentType: 'novel',
    confidence: 0.5,
    siteName,
    selectors: [
      { purpose: 'search', selector: 'input[name="searchkey"], input[name="keyword"]', confidence: 0.6 },
      { purpose: 'bookItem', selector: '.result-item, .book-list li, .novel-list li', confidence: 0.5 },
      { purpose: 'title', selector: 'h1, .title, .book-title', confidence: 0.5 },
      { purpose: 'author', selector: '.author, .book-author', confidence: 0.5 },
      { purpose: 'cover', selector: '.cover img, .book-cover img', confidence: 0.5 },
      { purpose: 'content', selector: '#content, #chaptercontent, .content, .chapter-content', confidence: 0.5 },
      { purpose: 'toc', selector: '#list dd, #chapterlist dd, .chapter-list li', confidence: 0.5 },
      { purpose: 'chapterName', selector: 'a', confidence: 0.5 },
      { purpose: 'chapterUrl', selector: 'a', confidence: 0.5 },
    ],
    adElements: [],
  }
}

// ── API 封装 ─────────────────────────────────────────────────────────────

export async function analyzeUrl(url: string, sampleUrls?: string[]): Promise<AnalysisResult> {
  try {
    const result = await invokeWithTimeout<AnalysisResult>(
      'booksource_analyze_url',
      { url, sampleUrls: sampleUrls ?? null },
      60000,
    )
    return result
  } catch (_err) {
    const mock = buildMockAnalysisResult(url)
    if (sampleUrls && sampleUrls.length > 0) {
      mock.sampleResults = sampleUrls.map((u) => buildMockAnalysisResult(u))
    }
    return mock
  }
}

// ── Vue Composable ───────────────────────────────────────────────────────

export function useSmartSourceDetector() {
  const state = reactive<SmartSourceState>({
    url: '',
    sampleUrls: [],
    progress: null,
    result: null,
    generatedCode: '',
    isAnalyzing: false,
    generatedFileName: '',
  })

  const error = shallowRef<string | null>(null)

  const url = computed({
    get: () => state.url,
    set: (v: string) => { state.url = v },
  })

  const sampleUrls = computed({
    get: () => state.sampleUrls,
    set: (v: string[]) => { state.sampleUrls = v },
  })

  const progress = computed(() => state.progress)
  const result = computed(() => state.result)
  const generatedCode = computed({
    get: () => state.generatedCode,
    set: (v: string) => { state.generatedCode = v },
  })
  const generatedFileName = computed(() => state.generatedFileName)
  const isAnalyzing = computed(() => state.isAnalyzing)

  function updateProgress(stage: AnalysisProgress['stage'], message: string) {
    state.progress = { stage, message }
  }

  function resetState() {
    state.progress = null
    state.result = null
    state.generatedCode = ''
    state.generatedFileName = ''
    error.value = null
  }

  function addSampleUrl(u: string) {
    const trimmed = u.trim()
    if (trimmed && !state.sampleUrls.includes(trimmed)) {
      state.sampleUrls.push(trimmed)
    }
  }

  function removeSampleUrl(index: number) {
    state.sampleUrls.splice(index, 1)
  }

  async function startAnalysis(targetUrl?: string) {
    const target = targetUrl?.trim() || state.url.trim()
    if (!target) {
      error.value = '请输入目标网站 URL'
      return
    }

    state.isAnalyzing = true
    error.value = null
    state.url = target
    resetState()

    try {
      updateProgress('connecting', '正在连接目标网站...')
      const analysisResult = await analyzeUrl(target, state.sampleUrls.length > 0 ? [...state.sampleUrls] : undefined)

      state.result = analysisResult
      updateProgress('generating', '正在生成书源代码...')

      const { code, fileName } = generateSourceCode(analysisResult)
      state.generatedCode = code
      state.generatedFileName = fileName

      updateProgress('done', '分析完成')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      if (state.progress && state.progress.stage !== 'done') {
        updateProgress('done', '分析失败: ' + msg)
      }
    } finally {
      state.isAnalyzing = false
    }
  }

  async function retryAnalysis() {
    if (!state.url.trim()) return
    await startAnalysis(state.url)
  }

  function regenerateCode() {
    if (!state.result) return
    const { code, fileName } = generateSourceCode(state.result)
    state.generatedCode = code
    state.generatedFileName = fileName
  }

  const progressPercent = computed(() => {
    if (!state.progress) return 0
    const stages: AnalysisProgress['stage'][] = [
      'connecting', 'loading', 'parsing', 'classifying',
      'filtering', 'extracting', 'generating', 'done',
    ]
    const idx = stages.indexOf(state.progress.stage)
    if (idx === -1) return 0
    return Math.round((idx / (stages.length - 1)) * 100)
  })

  return {
    url,
    sampleUrls,
    progress,
    result,
    generatedCode,
    generatedFileName,
    isAnalyzing,
    error: readonly(error),
    state: readonly(state) as SmartSourceState,
    progressPercent,
    addSampleUrl,
    removeSampleUrl,
    startAnalysis,
    retryAnalysis,
    regenerateCode,
  }
}