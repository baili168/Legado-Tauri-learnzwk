const MAX_CACHE_BYTES = 80 * 1024 * 1024

interface ComicImageCacheEntry {
  img: HTMLImageElement
  size: number
}

const cache = new Map<string, ComicImageCacheEntry>()
let totalSize = 0

function computeImageSize(img: HTMLImageElement): number {
  return img.naturalWidth * img.naturalHeight * 4
}

function evictUntil(neededBytes: number): void {
  while (totalSize + neededBytes > MAX_CACHE_BYTES && cache.size > 0) {
    const firstKey = cache.keys().next().value
    if (firstKey === undefined) break
    const entry = cache.get(firstKey)
    if (entry) {
      totalSize -= entry.size
    }
    cache.delete(firstKey)
  }
}

export function useComicMemoryCache() {
  function cacheImage(key: string, img: HTMLImageElement): void {
    const size = computeImageSize(img)
    if (size <= 0) return

    const existing = cache.get(key)
    if (existing) {
      totalSize -= existing.size
      cache.delete(key)
    }

    evictUntil(size)
    cache.set(key, { img, size })
    totalSize += size
  }

  function getImage(key: string): HTMLImageElement | undefined {
    const entry = cache.get(key)
    if (!entry) return undefined
    cache.delete(key)
    cache.set(key, entry)
    return entry.img
  }

  function clearChapter(chapterUrl: string): void {
    const prefix = `${chapterUrl}:`
    const keysToDelete: string[] = []
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key)
      }
    }
    for (const key of keysToDelete) {
      const entry = cache.get(key)
      if (entry) {
        totalSize -= entry.size
      }
      cache.delete(key)
    }
  }

  function clearAll(): void {
    cache.clear()
    totalSize = 0
  }

  function getCacheSize(): number {
    return totalSize
  }

  return { cacheImage, getImage, clearChapter, clearAll, getCacheSize }
}