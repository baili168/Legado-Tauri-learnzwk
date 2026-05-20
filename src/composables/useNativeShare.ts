import { ref } from 'vue'
import { copyText } from '@/utils/clipboard'

const isShareSupported = ref(false)
const isClipboardSupported = ref(false)

function detectCapabilities() {
  isShareSupported.value =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'

  isClipboardSupported.value =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.writeText === 'function'
}

if (typeof window !== 'undefined') {
  detectCapabilities()
}

async function fallbackCopyAndNotify(text: string, title?: string) {
  try {
    await copyText(text)
    showFallbackNotification(title ?? '已复制到剪贴板', text.substring(0, 100))
  } catch {
    console.error('复制失败')
  }
}

function showFallbackNotification(title: string, body: string) {
  if (
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    new Notification(title, { body })
  }
}

async function shareText(text: string, title?: string): Promise<boolean> {
  if (!isShareSupported.value) {
    await fallbackCopyAndNotify(text, title)
    return false
  }

  try {
    await navigator.share({ text, title })
    return true
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      err.name === 'AbortError'
    ) {
      return false
    }
    await fallbackCopyAndNotify(text, title)
    return false
  }
}

export interface ShareBookData {
  name: string
  author: string
  coverUrl?: string
  url: string
}

async function shareBook(bookData: ShareBookData): Promise<boolean> {
  const sharedText = `《${bookData.name}》作者：${bookData.author}\n${bookData.url}`
  const title = `推荐书籍：《${bookData.name}》`

  if (!isShareSupported.value) {
    await fallbackCopyAndNotify(sharedText, title)
    return false
  }

  const shareData: ShareData = {
    title,
    text: sharedText,
  }

  if (
    navigator.canShare &&
    typeof navigator.canShare === 'function'
  ) {
    const withUrl: ShareData = { ...shareData, url: bookData.url }
    if (navigator.canShare(withUrl)) {
      try {
        await navigator.share(withUrl)
        return true
      } catch (err: unknown) {
        if (
          err instanceof DOMException &&
          err.name === 'AbortError'
        ) {
          return false
        }
      }
    }
  }

  try {
    await navigator.share(shareData)
    return true
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      err.name === 'AbortError'
    ) {
      return false
    }
    await fallbackCopyAndNotify(sharedText, title)
    return false
  }
}

async function shareSelection(
  selectedText: string,
  bookName: string,
  chapterName: string,
): Promise<boolean> {
  const title = `《${bookName}》— ${chapterName}`
  const text = `「${selectedText}」\n—— 来自《${bookName}》${chapterName}`

  return shareText(text, title)
}

export function useNativeShare() {
  return {
    isShareSupported,
    shareText,
    shareBook,
    shareSelection,
  }
}