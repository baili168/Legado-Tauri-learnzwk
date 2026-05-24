<script setup lang="ts">
import { ChevronLeft, RotateCcw } from "lucide-vue-next"
import { ref } from "vue"
import { useKeyboardShortcuts, type KeyboardShortcut } from "@/composables/useKeyboardShortcuts"

defineProps<{
  volumeKeyPageTurnEnabled: boolean
}>()

const emit = defineEmits<{
  (e: "back"): void
}>()

const { getBindings, setBinding, resetToDefaults } = useKeyboardShortcuts()

const bindings = getBindings()
const listeningId = ref<string | null>(null)

function onBindingClick(binding: KeyboardShortcut): void {
  if (listeningId.value === binding.id) {
    listeningId.value = null
    return
  }
  listeningId.value = binding.id
}

function onKeyCapture(e: KeyboardEvent): void {
  if (!listeningId.value) return
  e.preventDefault()
  e.stopPropagation()
  setBinding(listeningId.value, [e.code])
  listeningId.value = null
}

function onReset(): void {
  resetToDefaults()
  listeningId.value = null
}

function keyName(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'Space',
    Escape: 'Esc',
    Enter: 'Enter',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
  }
  if (map[code]) return map[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">快捷键</span>
    <div class="reader-settings__shortcuts-spacer" />
    <button class="reader-settings__reset-btn" @click="onReset">
      <RotateCcw :size="14" />
      <span>重置默认</span>
    </button>
  </div>

  <div class="reader-settings__shortcuts" @keydown="onKeyCapture">
    <div
      v-for="binding in bindings"
      :key="binding.id"
      class="reader-settings__shortcut-row"
    >
      <div class="reader-settings__shortcut-info">
        <span class="reader-settings__shortcut-label">{{ binding.label }}</span>
        <span class="reader-settings__shortcut-desc">{{ binding.description }}</span>
      </div>
      <button
        class="reader-settings__shortcut-keys"
        :class="{ 'reader-settings__shortcut-keys--listening': listeningId === binding.id }"
        @click="onBindingClick(binding)"
      >
        <template v-if="listeningId === binding.id">
          <span class="reader-settings__shortcut-listening">按任意键...</span>
        </template>
        <template v-else>
          <kbd v-for="key in binding.keys" :key="key">{{ keyName(key) }}</kbd>
        </template>
      </button>
    </div>

    <div class="reader-settings__shortcut-note">
      点击快捷键区域可重新绑定，按键盘任意键完成绑定。再次点击取消。
      <template v-if="volumeKeyPageTurnEnabled">
        <br />音量键翻页已启用：音量+ 上一页，音量- 下一页。
      </template>
    </div>
  </div>
</template>

<style scoped>
.reader-settings__sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.reader-settings__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.reader-settings__back:hover {
  background: rgba(255, 255, 255, 0.1);
}

.reader-settings__sub-title {
  font-size: 0.875rem;
  font-weight: 600;
}

.reader-settings__shortcuts-spacer {
  flex: 1;
}

.reader-settings__reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: inherit;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  transition: background 0.15s;
}

.reader-settings__reset-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.reader-settings__shortcuts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reader-settings__shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.reader-settings__shortcut-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reader-settings__shortcut-label {
  font-size: 0.8125rem;
  font-weight: 500;
}

.reader-settings__shortcut-desc {
  font-size: 0.6875rem;
  opacity: 0.5;
}

.reader-settings__shortcut-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: border-color 0.15s, background 0.15s;
  color: inherit;
  flex-shrink: 0;
}

.reader-settings__shortcut-keys:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.reader-settings__shortcut-keys--listening {
  border-color: var(--color-primary, #818cf8);
  background: rgba(129, 140, 248, 0.1);
}

.reader-settings__shortcut-keys kbd {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.6875rem;
  font-family: inherit;
  line-height: 1.5;
}

.reader-settings__shortcut-listening {
  font-size: 0.6875rem;
  opacity: 0.7;
  font-style: italic;
}

.reader-settings__shortcut-note {
  font-size: 0.75rem;
  opacity: 0.45;
  line-height: 1.5;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>