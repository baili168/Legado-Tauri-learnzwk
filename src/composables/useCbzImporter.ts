import { ref } from "vue"
import JSZip from "jszip"

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]

const cbzBlobCache = new Map<string, string[]>()

export function useCbzImporter() {
  const progress = ref(0)
  const errorMsg = ref("")

  function disposeBlobUrls(urls: string[]) {
    for (const url of urls) {
      URL.revokeObjectURL(url)
    }
  }

  function clearCache(bookUrl: string) {
    const urls = cbzBlobCache.get(bookUrl)
    if (urls) {
      disposeBlobUrls(urls)
      cbzBlobCache.delete(bookUrl)
    }
  }

  async function importCbz(
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{ pages: string[]; coverUrl: string }> {
    progress.value = 0
    errorMsg.value = ""

    try {
      const zip = new JSZip()
      const zipContent = await zip.loadAsync(file)

      const imageFiles = Object.entries(zipContent.files)
        .filter(([name, entry]) => !entry.dir && IMAGE_EXTS.some((ext) => name.toLowerCase().endsWith(ext)))
        .sort(([a], [b]) => a.localeCompare(b))

      if (imageFiles.length === 0) {
        errorMsg.value = "CBZ 文件中未找到图片"
        return { pages: [], coverUrl: "" }
      }

      const total = imageFiles.length
      const pages: string[] = []

      for (let i = 0; i < imageFiles.length; i++) {
        const [_, zipEntry] = imageFiles[i]
        const blob = await zipEntry.async("blob")
        const url = URL.createObjectURL(blob)
        pages.push(url)

        const pct = Math.round(((i + 1) / total) * 100)
        progress.value = pct
        onProgress?.(pct)
      }

      const coverUrl = pages[0] || ""

      return { pages, coverUrl }
    } catch (err) {
      errorMsg.value = `解析 CBZ 文件失败: ${err instanceof Error ? err.message : String(err)}`
      return { pages: [], coverUrl: "" }
    }
  }

  function cachePages(bookUrl: string, pages: string[]) {
    clearCache(bookUrl)
    cbzBlobCache.set(bookUrl, [...pages])
  }

  function getCachedPages(bookUrl: string): string[] | undefined {
    return cbzBlobCache.get(bookUrl)
  }

  return { progress, errorMsg, importCbz, cachePages, getCachedPages, clearCache, disposeBlobUrls }
}