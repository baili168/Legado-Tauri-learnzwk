export interface EpubFootnote {
  id: string
  refText: string
  content: string
}

export interface EpubTocEntry {
  title: string
  href?: string
  level: number
  children: EpubTocEntry[]
}

function hasHtmlTags(text: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/i.test(text)
}

export function isEpubContent(sourceType: string, fileName: string, content: string): boolean {
  if (sourceType === 'epub') return true
  if (fileName && /\.epub$/i.test(fileName)) return true
  if (content && hasHtmlTags(content)) return true
  return false
}

export function parseEpubStyles(html: string): string {
  if (!html) return ''

  const styleMatches: string[] = []

  const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let match: RegExpExecArray | null
  while ((match = styleBlockRegex.exec(html)) !== null) {
    styleMatches.push(match[1])
  }

  const inlineStyleRegex = /style="([^"]*)"/gi
  while ((match = inlineStyleRegex.exec(html)) !== null) {
    styleMatches.push(`* { ${match[1]} }`)
  }

  return styleMatches.join('\n')
}

export function renderEpubContent(html: string): string {
  if (!html) return ''

  if (!hasHtmlTags(html)) {
    return html
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeEpubHtml(p.trim())}</p>`)
      .join('\n')
  }

  const styles = parseEpubStyles(html)
  const cleanedBody = extractEpubBody(html)
  const processedBody = processEpubHtml(cleanedBody)

  return [
    '<div class="epub-scoped-container">',
    styles ? `<style scoped>${styles}</style>` : '',
    '<div class="epub-scoped-content">',
    processedBody,
    '</div>',
    '</div>',
  ].join('\n')
}

function escapeEpubHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function extractEpubBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) return bodyMatch[1]

  const htmlBodyMatch = html.match(/<html[^>]*>[\s\S]*<body[^>]*>([\s\S]*)<\/body>[\s\S]*<\/html>/i)
  if (htmlBodyMatch) return htmlBodyMatch[1]

  return html
}

function processEpubHtml(html: string): string {
  let result = html

  result = result.replace(/<a\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, text) => {
    if (href.startsWith('#') || href.includes('footnote') || href.includes('fn')) {
      const refId = href.startsWith('#') ? href.slice(1) : href
      return `<sup class="epub-footnote-ref" data-footnote-id="${escapeEpubHtml(refId)}">${text}</sup>`
    }
    return `<a href="${escapeEpubHtml(href)}">${text}</a>`
  })

  result = result.replace(/<img\s+[^>]*src\s*=\s*["']([^"']*)["'][^>]*>/gi, (match) => {
    return match.replace(/src=/i, 'loading="lazy" src=')
  })

  result = result.replace(/<table[^>]*>/gi, (match) => {
    return match + '<div class="epub-table-wrapper">'
  })
  result = result.replace(/<\/table>/gi, '</div></table>')

  result = result.replace(/<svg[\s\S]*?<\/svg>/gi, (match) => {
    return `<div class="epub-svg-wrapper">${match}</div>`
  })

  return result
}

export function parseEpubToc(tocData: EpubTocEntry[]): {
  flatChapters: { title: string; href: string; level: number }[]
  tree: EpubTocEntry[]
} {
  if (!tocData || !Array.isArray(tocData)) {
    return { flatChapters: [], tree: [] }
  }

  const flatChapters: { title: string; href: string; level: number }[] = []

  function flatten(entries: EpubTocEntry[], level: number) {
    for (const entry of entries) {
      flatChapters.push({
        title: entry.title || '',
        href: entry.href || '',
        level,
      })
      if (entry.children && entry.children.length > 0) {
        flatten(entry.children, level + 1)
      }
    }
  }

  flatten(tocData, 1)

  return {
    flatChapters,
    tree: tocData,
  }
}

export function parseFootnotes(html: string): Map<string, EpubFootnote> {
  const footnoteMap = new Map<string, EpubFootnote>()

  if (!html) return footnoteMap

  const bodyContent = extractEpubBody(html)

  const refRegex = /<sup[^>]*>\s*<a\s+[^>]*href\s*=\s*["']#([^"']*)["'][^>]*id\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>\s*<\/sup>/gi
  let match: RegExpExecArray | null
  while ((match = refRegex.exec(bodyContent)) !== null) {
    const targetId = match[1]
    const refId = match[2]
    const refText = match[3].replace(/<[^>]*>/g, '').trim()
    if (!footnoteMap.has(refId)) {
      footnoteMap.set(refId, { id: refId, refText, content: '' })
    }
  }

  const refRegex2 = /<a\s+[^>]*href\s*=\s*["']#([^"']*)["'][^>]*epub:type\s*=\s*["']noteref["'][^>]*>([\s\S]*?)<\/a>/gi
  while ((match = refRegex2.exec(bodyContent)) !== null) {
    const targetId = match[1]
    const refText = match[2].replace(/<[^>]*>/g, '').trim()
    const refId = `noteref-${targetId}`
    if (!footnoteMap.has(refId)) {
      footnoteMap.set(refId, { id: refId, refText, content: '' })
    }
  }

  const targetRegex = /<(?:aside|div|p|li|span)\s+[^>]*(?:id\s*=\s*["']([^"']*)["']|epub:type\s*=\s*["'](?:footnote|rearnote)["'])[^>]*>([\s\S]*?)<\/(?:aside|div|p|li|span)>/gi
  while ((match = targetRegex.exec(bodyContent)) !== null) {
    const id = match[1] || match[2] || ''
    const content = match[3] || match[4] || ''
    if (id) {
      if (!footnoteMap.has(id)) {
        footnoteMap.set(id, { id, refText: '', content: content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() })
      } else {
        const existing = footnoteMap.get(id)!
        existing.content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
  }

  for (const [key, fn] of footnoteMap) {
    if (!fn.content) {
      const detailMatch = bodyContent.match(
        new RegExp(
          `<[^>]*id\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)<\\/[^>]*>`,
          'i',
        ),
      )
      if (detailMatch) {
        fn.content = detailMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
  }

  return footnoteMap
}

export function useEpubRenderer() {
  function detectEpub(sourceType: string, fileName: string, content: string): boolean {
    return isEpubContent(sourceType, fileName, content)
  }

  function render(html: string): string {
    return renderEpubContent(html)
  }

  function getFootnotes(html: string): Map<string, EpubFootnote> {
    return parseFootnotes(html)
  }

  function getToc(tocData: EpubTocEntry[]): ReturnType<typeof parseEpubToc> {
    return parseEpubToc(tocData)
  }

  return {
    detectEpub,
    render,
    getFootnotes,
    getToc,
  }
}