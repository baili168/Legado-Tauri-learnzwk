import { ref } from 'vue'
import { useReaderActionsStore } from '@/features/reader/stores/readerActions'
import { useReaderViewStore } from '@/features/reader/stores/readerView'

export interface KeyboardShortcut {
  id: string
  label: string
  description: string
  defaultKeys: string[]
  keys: string[]
  action: () => void
}

const SHORTCUTS_KEY = 'legado:keyboardShortcuts'

function saveBindings(bindings: KeyboardShortcut[]) {
  try {
    const data = bindings.map((b) => ({ id: b.id, keys: b.keys }))
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function loadBindings(bindings: KeyboardShortcut[]) {
  try {
    const raw = localStorage.getItem(SHORTCUTS_KEY)
    if (!raw) return
    const data: { id: string; keys: string[] }[] = JSON.parse(raw)
    for (const item of data) {
      const binding = bindings.find((b) => b.id === item.id)
      if (binding && item.keys.length > 0) {
        binding.keys = item.keys
      }
    }
  } catch {
    /* ignore */
  }
}

export function useKeyboardShortcuts() {
  const readerActions = useReaderActionsStore()
  const readerView = useReaderViewStore()
  const active = ref(false)

  const bindings: KeyboardShortcut[] = [
    {
      id: 'prev_page',
      label: '上一页',
      description: '翻到上一页',
      defaultKeys: ['ArrowLeft', 'KeyA'],
      keys: ['ArrowLeft', 'KeyA'],
      action: () => readerActions.onTap('left'),
    },
    {
      id: 'next_page',
      label: '下一页',
      description: '翻到下一页',
      defaultKeys: ['ArrowRight', 'KeyD'],
      keys: ['ArrowRight', 'KeyD'],
      action: () => readerActions.onTap('right'),
    },
    {
      id: 'prev_chapter',
      label: '上一章',
      description: '跳转到上一章',
      defaultKeys: ['ArrowUp', 'KeyW'],
      keys: ['ArrowUp', 'KeyW'],
      action: () => readerActions.gotoPrevChapter(),
    },
    {
      id: 'next_chapter',
      label: '下一章',
      description: '跳转到下一章',
      defaultKeys: ['ArrowDown', 'KeyS'],
      keys: ['ArrowDown', 'KeyS'],
      action: () => readerActions.gotoNextChapter(),
    },
    {
      id: 'close',
      label: '关闭阅读',
      description: '返回书架',
      defaultKeys: ['Escape'],
      keys: ['Escape'],
      action: () => readerActions.close(),
    },
  ]

  loadBindings(bindings)

  function getBindings(): KeyboardShortcut[] {
    return bindings
  }

  function resetToDefaults(): void {
    for (const b of bindings) {
      b.keys = [...b.defaultKeys]
    }
    saveBindings(bindings)
  }

  function setBinding(id: string, newKeys: string[]): void {
    const binding = bindings.find((b) => b.id === id)
    if (!binding) return
    binding.keys = newKeys

    for (const other of bindings) {
      if (other.id !== id) {
        other.keys = other.keys.filter((k) => !newKeys.includes(k))
      }
    }

    saveBindings(bindings)
  }

  function onKeydown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if ((e.target as HTMLElement)?.isContentEditable) return

    for (const binding of bindings) {
      if (binding.keys.includes(e.code)) {
        e.preventDefault()
        binding.action()
        return
      }
    }
  }

  function startListening(): void {
    if (active.value) return
    active.value = true
    window.addEventListener('keydown', onKeydown)
  }

  function stopListening(): void {
    if (!active.value) return
    active.value = false
    window.removeEventListener('keydown', onKeydown)
  }

  return {
    bindings,
    active,
    getBindings,
    setBinding,
    resetToDefaults,
    startListening,
    stopListening,
  }
}