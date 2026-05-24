<script setup lang="ts">
import { ref, watch, nextTick } from "vue"
import type { EpubFootnote } from "@/composables/useEpubRenderer"

const props = defineProps<{
  footnote: EpubFootnote | null
  anchorEl: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "scroll-back"): void
}>()

const popupRef = ref<HTMLElement | null>(null)
const position = ref({ x: 0, y: 0 })
const visible = ref(false)

watch(
  () => props.footnote,
  async (fn) => {
    if (fn && props.anchorEl) {
      updatePosition()
      visible.value = true
        ; (document.activeElement as HTMLElement)?.blur?.()
    } else {
      visible.value = false
    }
  },
)

function updatePosition() {
  if (!props.anchorEl) return

  const rect = props.anchorEl.getBoundingClientRect()
  const popupWidth = 300
  const popupHeight = 200

  let x = rect.left + rect.width / 2 - popupWidth / 2
  let y = rect.bottom + 8

  if (x < 8) x = 8
  if (x + popupWidth > window.innerWidth - 8) {
    x = window.innerWidth - popupWidth - 8
  }

  if (y + popupHeight > window.innerHeight - 8) {
    y = rect.top - popupHeight - 8
  }

  if (y < 8) y = 8

  position.value = { x, y }
}

function onClose() {
  visible.value = false
  emit("close")
}

function onScrollBack() {
  visible.value = false
  emit("scroll-back")
  emit("close")
}

function onOverlayClick(e: MouseEvent) {
  if (popupRef.value && !popupRef.value.contains(e.target as Node)) {
    onClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fn-popup-fade">
      <div v-if="visible && footnote" class="epub-footnote-overlay" @click="onOverlayClick">
        <div
          ref="popupRef"
          class="epub-footnote-popup"
          :style="{ left: position.x + 'px', top: position.y + 'px' }"
        >
          <div class="epub-footnote-popup__header">
            <span class="epub-footnote-popup__label">脚注</span>
            <button class="epub-footnote-popup__close" title="关闭" @click="onClose">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="epub-footnote-popup__body">
            <p v-if="footnote.refText" class="epub-footnote-popup__ref">
              <sup class="epub-footnote-popup__ref-mark">{{ footnote.refText }}</sup>
            </p>
            <p class="epub-footnote-popup__content">{{ footnote.content }}</p>
          </div>
          <div class="epub-footnote-popup__footer">
            <button class="epub-footnote-popup__back-link" @click="onScrollBack">
              返回原文
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.epub-footnote-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-toast, 10000);
}

.epub-footnote-popup {
  position: fixed;
  width: 300px;
  max-width: calc(100vw - 16px);
  max-height: 280px;
  display: flex;
  flex-direction: column;
  background: var(--gray-0, #fff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: var(--radius-2, 12px);
  box-shadow: var(--shadow-3, 0 12px 40px rgba(0, 0, 0, 0.12));
  overflow: hidden;
  font-family: var(--font-ui);
}

.epub-footnote-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-bottom: 1px solid var(--gray-100, #f3f4f6);
  flex-shrink: 0;
}

.epub-footnote-popup__label {
  font-size: var(--fs-12, 12px);
  font-weight: var(--fw-semibold, 600);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.epub-footnote-popup__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--radius-1, 6px);
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--dur-fast, 0.15s) var(--ease-standard);
}

.epub-footnote-popup__close:hover {
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-700);
}

.epub-footnote-popup__body {
  padding: var(--space-3, 12px);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.epub-footnote-popup__ref {
  margin: 0 0 var(--space-2, 8px);
  font-size: var(--fs-13, 13px);
  color: var(--color-text-muted);
}

.epub-footnote-popup__ref-mark {
  color: var(--color-accent, #3b82f6);
  font-weight: var(--fw-semibold, 600);
}

.epub-footnote-popup__content {
  margin: 0;
  font-size: var(--fs-14, 14px);
  line-height: var(--lh-normal, 1.6);
  color: var(--color-text);
  word-break: break-word;
}

.epub-footnote-popup__footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-top: 1px solid var(--gray-100, #f3f4f6);
  flex-shrink: 0;
}

.epub-footnote-popup__back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: none;
  background: transparent;
  border-radius: var(--radius-1, 6px);
  font-size: var(--fs-13, 13px);
  color: var(--color-accent, #3b82f6);
  cursor: pointer;
  transition: all var(--dur-fast, 0.15s) var(--ease-standard);
}

.epub-footnote-popup__back-link:hover {
  background: rgba(59, 130, 246, 0.08);
}

.fn-popup-fade-enter-active,
.fn-popup-fade-leave-active {
  transition: opacity 0.15s ease;
}

.fn-popup-fade-enter-from,
.fn-popup-fade-leave-to {
  opacity: 0;
}

.fn-popup-fade-enter-active .epub-footnote-popup {
  transition: transform 0.2s var(--ease-standard);
}

.fn-popup-fade-enter-from .epub-footnote-popup {
  transform: translateY(4px) scale(0.98);
}
</style>