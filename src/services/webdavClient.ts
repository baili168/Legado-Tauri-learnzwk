export interface WebDAVConfig {
  url: string
  username: string
  password: string
}

export interface BookSyncEntry {
  bookId: string
  bookUrl: string
  name: string
  author: string
  readChapterIndex: number
  readPageIndex: number
  readScrollRatio: number
  totalChapters: number
  lastReadAt: number
}

export interface BookManifestEntry {
  lastModified: number
  readChapterIndex: number
  readPageIndex: number
  readScrollRatio: number
  totalChapters: number
  name: string
}

export interface SyncManifest {
  books: Record<string, BookManifestEntry>
  lastSyncTime: number
}

export const SYNC_MANIFEST_PATH = "legado-sync-manifest.json"

function normalizeUrl(config: WebDAVConfig): string {
  let url = config.url.trim()
  if (!url.endsWith("/")) {
    url += "/"
  }
  return url
}

function authHeader(config: WebDAVConfig): string {
  return "Basic " + btoa(`${config.username}:${config.password}`)
}

export async function testConnection(config: WebDAVConfig): Promise<boolean> {
  const baseUrl = normalizeUrl(config)
  try {
    const response = await fetch(baseUrl, {
      method: "OPTIONS",
      headers: {
        Authorization: authHeader(config),
      },
    })
    if (response.ok) {
      return true
    }
    const propfindResponse = await fetch(baseUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: authHeader(config),
        Depth: "0",
      },
    })
    return propfindResponse.ok
  } catch {
    return false
  }
}

export async function uploadFile(
  config: WebDAVConfig,
  path: string,
  content: string,
): Promise<void> {
  const baseUrl = normalizeUrl(config)
  const filePath = path.startsWith("/") ? path.slice(1) : path
  const url = baseUrl + filePath

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
    },
    body: content,
  })

  if (!response.ok) {
    throw new Error(`上传失败: HTTP ${response.status} ${response.statusText}`)
  }
}

export async function downloadFile(config: WebDAVConfig, path: string): Promise<string> {
  const baseUrl = normalizeUrl(config)
  const filePath = path.startsWith("/") ? path.slice(1) : path
  const url = baseUrl + filePath

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader(config),
    },
  })

  if (!response.ok) {
    throw new Error(`下载失败: HTTP ${response.status} ${response.statusText}`)
  }

  return response.text()
}

export async function listFiles(config: WebDAVConfig): Promise<string[]> {
  const baseUrl = normalizeUrl(config)
  try {
    const response = await fetch(baseUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: authHeader(config),
        Depth: "1",
        "Content-Type": "application/xml",
      },
    })

    if (!response.ok) {
      throw new Error(`列出文件失败: HTTP ${response.status} ${response.statusText}`)
    }

    const xmlText = await response.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, "text/xml")
    const responses = xmlDoc.getElementsByTagNameNS("DAV:", "response")
    const files: string[] = []

    for (let i = 0; i < responses.length; i++) {
      const hrefElement = responses[i].getElementsByTagNameNS("DAV:", "href")
      if (hrefElement.length > 0) {
        const href = hrefElement[0].textContent || ""
        const decoded = decodeURIComponent(href)
        const fileName = decoded.replace(baseUrl, "").replace(/\/$/, "").split("/").pop() || ""
        if (fileName && fileName.startsWith("legado-backup-") && fileName.endsWith(".json")) {
          files.push(fileName)
        }
      }
    }

    return files.sort().reverse()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("列出文件失败")) {
      throw error
    }
    throw new Error(`列出文件失败: ${error}`)
  }
}

export async function getLastModified(
  config: WebDAVConfig,
  path: string,
): Promise<{ etag: string; lastModified: string } | null> {
  const baseUrl = normalizeUrl(config)
  const filePath = path.startsWith("/") ? path.slice(1) : path
  const url = baseUrl + filePath

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        Authorization: authHeader(config),
      },
    })

    if (!response.ok) {
      return null
    }

    return {
      etag: response.headers.get("etag") || "",
      lastModified: response.headers.get("last-modified") || "",
    }
  } catch {
    return null
  }
}

export async function downloadManifest(config: WebDAVConfig): Promise<SyncManifest | null> {
  try {
    const raw = await downloadFile(config, SYNC_MANIFEST_PATH)
    return JSON.parse(raw) as SyncManifest
  } catch {
    return null
  }
}

export async function uploadManifest(config: WebDAVConfig, manifest: SyncManifest): Promise<void> {
  return uploadFile(config, SYNC_MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

export function extractBookEntries(backupJson: string): BookSyncEntry[] {
  const backup = JSON.parse(backupJson)
  const books: BookSyncEntry[] = []

  const booksKey = Object.keys(backup.localStorage || {}).find(
    (k: string) => k.startsWith("legado") && k.includes("book"),
  )

  if (booksKey && backup.localStorage[booksKey]) {
    try {
      const bookData = JSON.parse(backup.localStorage[booksKey])
      if (Array.isArray(bookData)) {
        for (const b of bookData) {
          books.push({
            bookId: b.id || b.bookUrl || "",
            bookUrl: b.bookUrl || "",
            name: b.name || "",
            author: b.author || "",
            readChapterIndex: b.readChapterIndex ?? -1,
            readPageIndex: b.readPageIndex ?? -1,
            readScrollRatio: b.readScrollRatio ?? -1,
            totalChapters: b.totalChapters ?? 0,
            lastReadAt: b.lastReadAt || 0,
          })
        }
      }
    } catch {
      /* ignore parse errors */
    }
  }

  return books
}

export function getIncrementalChanges(
  localEntries: BookSyncEntry[],
  remoteManifest: SyncManifest | null,
): {
  toUpload: BookSyncEntry[]
  toDownload: string[]
  unchanged: number
} {
  if (!remoteManifest || !remoteManifest.books) {
    return {
      toUpload: localEntries,
      toDownload: [],
      unchanged: 0,
    }
  }

  const toUpload: BookSyncEntry[] = []
  const toDownload: string[] = []
  let unchanged = 0

  const remoteBookIds = new Set(Object.keys(remoteManifest.books))

  for (const local of localEntries) {
    const id = local.bookId || local.bookUrl
    const remote = remoteManifest.books[id]

    if (!remote) {
      toUpload.push(local)
    } else if (local.lastReadAt > remote.lastModified) {
      toUpload.push(local)
    } else if (local.lastReadAt < remote.lastModified) {
      toDownload.push(id)
    } else {
      unchanged++
    }
    remoteBookIds.delete(id)
  }

  for (const remainingId of remoteBookIds) {
    toDownload.push(remainingId)
  }

  return { toUpload, toDownload, unchanged }
}

export function buildManifestFromEntries(entries: BookSyncEntry[]): SyncManifest {
  const books: Record<string, BookManifestEntry> = {}

  for (const entry of entries) {
    const id = entry.bookId || entry.bookUrl
    books[id] = {
      lastModified: entry.lastReadAt,
      readChapterIndex: entry.readChapterIndex,
      readPageIndex: entry.readPageIndex,
      readScrollRatio: entry.readScrollRatio,
      totalChapters: entry.totalChapters,
      name: entry.name,
    }
  }

  return {
    books,
    lastSyncTime: Date.now(),
  }
}

export async function uploadIncremental(
  config: WebDAVConfig,
  changes: BookSyncEntry[],
): Promise<{ uploaded: number; errors: string[] }> {
  let uploaded = 0
  const errors: string[] = []

  for (const entry of changes) {
    const id = entry.bookId || entry.bookUrl
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_")
    const path = `legado-sync-book-${safeId}.json`

    try {
      await uploadFile(config, path, JSON.stringify(entry, null, 2))
      uploaded++
    } catch (e) {
      errors.push(`${entry.name}: ${e}`)
    }
  }

  return { uploaded, errors }
}

export async function downloadIncremental(
  config: WebDAVConfig,
  bookIds: string[],
): Promise<BookSyncEntry[]> {
  const results: BookSyncEntry[] = []

  for (const id of bookIds) {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_")
    const path = `legado-sync-book-${safeId}.json`

    try {
      const raw = await downloadFile(config, path)
      const entry = JSON.parse(raw) as BookSyncEntry
      results.push(entry)
    } catch {
      /* skip missing entries */
    }
  }

  return results
}

export function buildIncrementalBackupJson(
  entries: BookSyncEntry[],
  baseBackup: string,
): string {
  const backup = JSON.parse(baseBackup)
  if (!backup.localStorage) {
    return baseBackup
  }

  const booksKey = Object.keys(backup.localStorage).find(
    (k: string) => k.startsWith("legado") && k.includes("book"),
  )

  if (booksKey) {
    try {
      const existingBooks = JSON.parse(backup.localStorage[booksKey])
      if (Array.isArray(existingBooks)) {
        for (const entry of entries) {
          const idx = existingBooks.findIndex(
            (b: { id?: string; bookUrl?: string }) =>
              (b.id && b.id === entry.bookId) || (b.bookUrl && b.bookUrl === entry.bookUrl),
          )
          if (idx >= 0) {
            existingBooks[idx] = {
              ...existingBooks[idx],
              readChapterIndex: entry.readChapterIndex,
              readPageIndex: entry.readPageIndex,
              readScrollRatio: entry.readScrollRatio,
              lastReadAt: entry.lastReadAt,
            }
          } else {
            existingBooks.push(entry)
          }
        }
        backup.localStorage[booksKey] = JSON.stringify(existingBooks)
      }
    } catch {
      /* ignore */
    }
  }

  return JSON.stringify(backup, null, 2)
}