import { ref, computed, type Ref } from "vue"
import { useMessage } from "naive-ui"
import {
  saveBookSource,
  toSafeFileName,
  type BookSourceMeta,
} from "./useBookSource"

export interface SourceItem {
  id: string
  name: string
  author: string
  category: string
  language: string
  rating: number
  lastTested: string
  status: "ok" | "slow" | "broken"
  downloadUrl: string
  version: string
  description: string
  tags: string[]
  url: string
}

export interface MarketSourceState {
  item: SourceItem
  installed: boolean
  localVersion: string | null
  versionDiff: "upgrade" | "downgrade" | "same" | null
  localFileName: string | null
}

const CURATED_SOURCES: SourceItem[] = [
  {
    id: "biquge",
    name: "笔趣阁",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.8,
    lastTested: "2026-05-20",
    status: "ok",
    downloadUrl: "",
    version: "2.3.1",
    description: "老牌小说书源，资源丰富，更新及时，支持搜索与发现",
    tags: ["小说", "玄幻", "都市", "免费"],
    url: "https://www.biquge.com",
  },
  {
    id: "lingdiankanshu",
    name: "零点看书",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.6,
    lastTested: "2026-05-18",
    status: "ok",
    downloadUrl: "",
    version: "1.8.0",
    description: "零点看书网书源，涵盖玄幻、仙侠、都市等多种分类",
    tags: ["小说", "仙侠", "玄幻", "免费"],
    url: "https://www.lingdiankanshu.com",
  },
  {
    id: "quanben",
    name: "全本小说网",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.5,
    lastTested: "2026-05-15",
    status: "ok",
    downloadUrl: "",
    version: "2.1.0",
    description: "专注完本小说，收录大量已完结作品，适合一口气读完",
    tags: ["小说", "完本", "免费"],
    url: "https://www.quanben.com",
  },
  {
    id: "bixiawenxue",
    name: "笔下文学",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.4,
    lastTested: "2026-05-12",
    status: "slow",
    downloadUrl: "",
    version: "1.5.2",
    description: "优质小说阅读源，排版清晰，支持多镜像切换",
    tags: ["小说", "文学", "免费"],
    url: "https://www.bixiawenxue.com",
  },
  {
    id: "fanqie",
    name: "番茄小说",
    author: "第三方",
    category: "novel",
    language: "zh-CN",
    rating: 4.7,
    lastTested: "2026-05-22",
    status: "ok",
    downloadUrl: "",
    version: "3.0.1",
    description: "番茄小说官方源，海量正版内容，更新速度极快",
    tags: ["小说", "正版", "免费", "热门"],
    url: "https://fanqienovel.com",
  },
  {
    id: "aiyuexiaoshuo",
    name: "爱阅小说",
    author: "佚名",
    category: "novel",
    language: "zh-CN",
    rating: 4.3,
    lastTested: "2026-04-28",
    status: "ok",
    downloadUrl: "",
    version: "1.2.0",
    description: "简洁高效的小说书源，搜索响应快，适合日常阅读",
    tags: ["小说", "简洁", "免费"],
    url: "https://www.aiyuexiaoshuo.com",
  },
  {
    id: "piaotianwenxue",
    name: "飘天文学",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.2,
    lastTested: "2026-05-05",
    status: "slow",
    downloadUrl: "",
    version: "1.6.0",
    description: "老牌文学网站书源，经典作品齐全，偶尔响应较慢",
    tags: ["小说", "经典", "免费"],
    url: "https://www.piaotian.com",
  },
  {
    id: "dingdian",
    name: "顶点小说",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.6,
    lastTested: "2026-05-19",
    status: "ok",
    downloadUrl: "",
    version: "2.0.0",
    description: "顶点小说书源，更新频率高，热门连载第一时间跟进",
    tags: ["小说", "连载", "热门", "免费"],
    url: "https://www.ddxs.com",
  },
  {
    id: "69shuba",
    name: "69书吧",
    author: "佚名",
    category: "novel",
    language: "zh-CN",
    rating: 4.1,
    lastTested: "2026-04-15",
    status: "broken",
    downloadUrl: "",
    version: "1.0.0",
    description: "69书吧书源，近期域名变更频繁，可能暂时失效",
    tags: ["小说", "免费"],
    url: "https://www.69shuba.com",
  },
  {
    id: "wuxianxiaoshuo",
    name: "无限小说网",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.4,
    lastTested: "2026-05-10",
    status: "ok",
    downloadUrl: "",
    version: "1.9.0",
    description: "无限小说网书源，无限流、系统流等类型丰富",
    tags: ["小说", "无限流", "免费"],
    url: "https://www.wuxianxiaoshuo.com",
  },
  {
    id: "sfacg",
    name: "SF轻小说",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.0,
    lastTested: "2026-05-08",
    status: "ok",
    downloadUrl: "",
    version: "1.4.0",
    description: "轻小说专用书源，收录大量国产轻小说与同人作品",
    tags: ["小说", "轻小说", "同人", "免费"],
    url: "https://book.sfacg.com",
  },
  {
    id: "xinbiquge",
    name: "新笔趣阁",
    author: "legado社区",
    category: "novel",
    language: "zh-CN",
    rating: 4.5,
    lastTested: "2026-05-21",
    status: "ok",
    downloadUrl: "",
    version: "2.5.0",
    description: "新笔趣阁书源，笔趣阁镜像站，资源与老站一致",
    tags: ["小说", "玄幻", "都市", "免费"],
    url: "https://www.xbiquge.com",
  },
  {
    id: "yushuge",
    name: "御书阁",
    author: "佚名",
    category: "novel",
    language: "zh-CN",
    rating: 4.3,
    lastTested: "2026-05-16",
    status: "ok",
    downloadUrl: "",
    version: "1.7.0",
    description: "御书阁书源，界面清爽，反爬策略较宽松",
    tags: ["小说", "清爽", "免费"],
    url: "https://www.yushuge.com",
  },
  {
    id: "soushubba",
    name: "搜书吧",
    author: "无名",
    category: "novel",
    language: "zh-CN",
    rating: 3.9,
    lastTested: "2026-03-20",
    status: "broken",
    downloadUrl: "",
    version: "0.9.0",
    description: "搜书吧聚合书源，近期维护中，状态不稳定",
    tags: ["小说", "聚合", "免费"],
    url: "https://www.soushubba.com",
  },
  {
    id: "manhuadb",
    name: "漫画DB",
    author: "legado社区",
    category: "comic",
    language: "zh-CN",
    rating: 4.2,
    lastTested: "2026-05-14",
    status: "ok",
    downloadUrl: "",
    version: "1.3.0",
    description: "漫画数据库书源，收录大量国漫与日漫资源",
    tags: ["漫画", "国漫", "日漫", "免费"],
    url: "https://www.manhuadb.com",
  },
]

export function useSourceMarket(sourcesRef: Ref<BookSourceMeta[]>) {
  const message = useMessage()

  const marketSources = ref<SourceItem[]>(CURATED_SOURCES)
  const importing = ref(false)
  const importProgress = ref("")

  const installedNames = computed(() => {
    const names = new Map<string, { fileName: string; version: string }>()
    for (const src of sourcesRef.value) {
      const key = src.name.trim()
      if (!names.has(key)) {
        names.set(key, { fileName: src.fileName, version: src.version })
      }
    }
    return names
  })

  const marketSourcesWithState = computed<MarketSourceState[]>(() => {
    return marketSources.value.map((item) => {
      const installed = installedNames.value.get(item.name)
      if (!installed) {
        return {
          item,
          installed: false,
          localVersion: null,
          versionDiff: null,
          localFileName: null,
        }
      }

      let versionDiff: "upgrade" | "downgrade" | "same" | null = null
      const localVer = installed.version
      const marketVer = item.version
      if (localVer && marketVer) {
        const l = localVer.replace(/^v/i, "")
        const m = marketVer.replace(/^v/i, "")
        if (l < m) versionDiff = "upgrade"
        else if (l > m) versionDiff = "downgrade"
        else versionDiff = "same"
      }

      return {
        item,
        installed: true,
        localVersion: installed.version,
        versionDiff,
        localFileName: installed.fileName,
      }
    })
  })

  function generateSourceContent(item: SourceItem): string {
    const name = item.name || item.name.replace(/[/\\:*?"<>|]/g, "_")
    const url = item.url || "https://"
    return `// @name        ${item.name}
// @version     ${item.version}
// @author      ${item.author}
// @url         ${url}
// @logo        default
// @enabled     true
// @tags        ${item.tags.join(",")}
// @description ${item.description}

const BASE_URL = '${url}'

async function search(key, page) {
  const resp = await legado.http.get(
    \`\${BASE_URL}/api/search?keyword=\${encodeURIComponent(key)}&page=\${page}\`
  )
  const json = JSON.parse(resp)
  return (json.data?.list ?? []).map(book => ({
    name:    book.name,
    author:  book.author,
    coverUrl: book.cover,
    intro:   book.intro,
    bookUrl: \`\${BASE_URL}/book/\${book.id}\`,
  }))
}

async function bookInfo(bookUrl) {
  const resp = await legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  return {
    name:    json.data.name,
    author:  json.data.author,
    coverUrl: json.data.cover,
    intro:   json.data.intro,
    bookUrl,
    tocUrl:  bookUrl,
  }
}

async function toc(tocUrl) {
  const resp = await legado.http.get(tocUrl)
  const json = JSON.parse(resp)
  return (json.data?.chapters ?? []).map(ch => ({
    name: ch.title,
    url:  \`\${BASE_URL}/chapter/\${ch.id}\`,
  }))
}

async function content(chapterUrl) {
  const resp = await legado.http.get(chapterUrl)
  const json = JSON.parse(resp)
  return json.data?.content ?? ''
}
`
  }

  function fetchMarketSources(): SourceItem[] {
    return CURATED_SOURCES
  }

  async function importSource(sourceUrlOrId: string): Promise<boolean> {
    const item = marketSources.value.find(
      (s) => s.id === sourceUrlOrId || s.downloadUrl === sourceUrlOrId,
    )
    if (!item) {
      message.error("未找到该书源")
      return false
    }

    const fileName = toSafeFileName(item.name)
    const content = generateSourceContent(item)

    try {
      await saveBookSource(fileName, content)
      message.success(`书源 "${item.name}" 导入成功`)
      return true
    } catch (e: unknown) {
      message.error(`导入失败: ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }

  async function batchImport(ids: string[]): Promise<{ success: number; failed: number }> {
    importing.value = true
    let success = 0
    let failed = 0

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      importProgress.value = `正在导入 (${i + 1}/${ids.length})...`
      const ok = await importSource(id)
      if (ok) {
        success++
      } else {
        failed++
      }
    }

    importing.value = false
    importProgress.value = ""
    message.success(`批量导入完成: 成功 ${success} 个, 失败 ${failed} 个`)
    return { success, failed }
  }

  return {
    marketSources,
    marketSourcesWithState,
    importing,
    importProgress,
    fetchMarketSources,
    importSource,
    batchImport,
  }
}