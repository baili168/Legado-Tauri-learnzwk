<template>
  <Teleport to="body">
    <Transition name="toolbar-fade">
      <div
        v-if="visible"
        ref="toolbarRef"
        class="selection-toolbar"
        :style="toolbarStyle"
      >
        <button
          v-for="color in highlightColors"
          :key="color.value"
          class="toolbar-btn color-btn"
          :title="`高亮为${color.label}`"
          @click="handleHighlight(color.value)"
        >
          <span class="color-dot" :style="{ backgroundColor: color.hex }"></span>
        </button>

        <div class="toolbar-divider"></div>

        <button
          class="toolbar-btn"
          title="添加笔记"
          @click="handleAddNote"
        >
          <BookMark :size="16" />
        </button>

        <button
          class="toolbar-btn"
          title="复制"
          @click="handleCopy"
        >
          <Copy :size="16" />
        </button>

        <button
          class="toolbar-btn"
          title="搜索"
          @click="handleSearch"
        >
          <Search :size="16" />
        </button>

        <button
          class="toolbar-btn"
          title="分享"
          @click="handleShare"
        >
          <Share2 :size="16" />
        </button>
      </div>
    </Transition>
  </Teleport>

  <AnnotationNoteEditor
    v-model:visible="noteEditorVisible"
    :highlight="pendingHighlight"
    @save="handleNoteSave"
    @close="handleNoteClose"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { BookMark, Copy, Search, Share2 } from 'lucide-vue-next';
import { NPopover } from 'naive-ui';
import type { HighlightColor, HighlightAnnotation } from '@/features/reader/stores/readerBookmarks';
import AnnotationNoteEditor from './AnnotationNoteEditor.vue';
import { useNativeShare } from '@/composables/useNativeShare';

interface HighlightColorOption {
  value: HighlightColor;
  label: string;
  hex: string;
}

const highlightColors: HighlightColorOption[] = [
  { value: 'yellow', label: '黄色', hex: '#fef08a' },
  { value: 'blue', label: '蓝色', hex: '#93c5fd' },
  { value: 'green', label: '绿色', hex: '#86efac' },
  { value: 'pink', label: '粉色', hex: '#f9a8d4' },
];

const visible = ref(false);
const toolbarRef = ref<HTMLElement | null>(null);
const position = ref({ x: 0, y: 0 });

const noteEditorVisible = ref(false);
const pendingHighlight = ref<HighlightAnnotation | null>(null);

const emit = defineEmits<{
  highlight: [
    text: string,
    color: HighlightColor,
    startOffset: number,
    endOffset: number,
  ];
  addNote: [highlight: HighlightAnnotation];
}>();

interface ReaderContext {
  bookUrl: string;
  fileName: string;
  chapterIndex: number;
  chapterName: string;
}

const readerContext = ref<ReaderContext | null>(null);

function setReaderContext(context: ReaderContext) {
  readerContext.value = context;
}

defineExpose({ setReaderContext });

const toolbarStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}));

function updateToolbarPosition() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    visible.value = false;
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const toolbarWidth = 200;
  const toolbarHeight = 40;

  let x = rect.left + rect.width / 2 - toolbarWidth / 2 + window.scrollX;
  let y = rect.top - toolbarHeight - 8 + window.scrollY;

  if (x < 8) x = 8;
  if (x + toolbarWidth > window.innerWidth - 8) {
    x = window.innerWidth - toolbarWidth - 8;
  }

  if (y < 8) {
    y = rect.bottom + 8 + window.scrollY;
  }

  position.value = { x, y };
  visible.value = true;
}

function handleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    visible.value = false;
    return;
  }

  const selectedText = selection.toString().trim();
  if (selectedText.length > 0) {
    updateToolbarPosition();
  } else {
    visible.value = false;
  }
}

function getSelectionOffsets(): { start: number; end: number } {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return { start: 0, end: 0 };
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  let offset = 0;
  let startOffset = 0;
  let endOffset = 0;
  let foundStart = false;

  function walk(node: Node) {
    if (node === range.startContainer) {
      startOffset = offset + range.startOffset;
      foundStart = true;
    }
    if (node === range.endContainer) {
      endOffset = offset + range.endOffset;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!foundStart) {
        offset += text.length;
      } else {
        offset += text.length;
      }
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child);
        if (foundStart && node === range.endContainer) {
          return;
        }
      }
    }
  }

  const root = container.nodeType === Node.TEXT_NODE
    ? container.parentElement
    : container as Element;

  if (root) {
    const textContent = root.textContent || '';
    offset = 0;

    const preRange = document.createRange();
    preRange.selectNodeContents(root);
    preRange.setEnd(range.startContainer, range.startOffset);
    startOffset = preRange.toString().length;

    preRange.setEnd(range.endContainer, range.endOffset);
    endOffset = preRange.toString().length;
  }

  return { start: startOffset, end: endOffset };
}

async function handleHighlight(color: HighlightColor) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const selectedText = selection.toString().trim();
  if (!selectedText) return;

  const { start, end } = getSelectionOffsets();

  emit('highlight', selectedText, color, start, end);

  selection.removeAllRanges();
  visible.value = false;
}

function handleAddNote() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const selectedText = selection.toString().trim();
  if (!selectedText || !readerContext.value) return;

  const { start, end } = getSelectionOffsets();

  pendingHighlight.value = {
    id: `temp-${Date.now()}`,
    bookUrl: readerContext.value.bookUrl,
    fileName: readerContext.value.fileName,
    chapterIndex: readerContext.value.chapterIndex,
    chapterName: readerContext.value.chapterName,
    startOffset: start,
    endOffset: end,
    text: selectedText,
    color: 'yellow',
    createdAt: Date.now(),
  };

  noteEditorVisible.value = true;
  selection.removeAllRanges();
  visible.value = false;
}

async function handleCopy() {
  const selection = window.getSelection();
  if (!selection) return;

  const selectedText = selection.toString();
  try {
    await navigator.clipboard.writeText(selectedText);
  } catch (err) {
    console.error('复制失败:', err);
  }

  selection.removeAllRanges();
  visible.value = false;
}

function handleSearch() {
  const selection = window.getSelection();
  if (!selection) return;

  const selectedText = selection.toString().trim();
  if (!selectedText) return;

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`;
  window.open(searchUrl, '_blank');

  selection.removeAllRanges();
  visible.value = false;
}

async function handleShare() {
  const selection = window.getSelection();
  if (!selection) return;

  const selectedText = selection.toString().trim();
  if (!selectedText || !readerContext.value) return;

  const { shareSelection } = useNativeShare();
  await shareSelection(
    selectedText,
    readerContext.value.fileName || '未知书籍',
    readerContext.value.chapterName || '未知章节',
  );

  selection.removeAllRanges();
  visible.value = false;
}

function handleNoteSave(note: string) {
  if (pendingHighlight.value) {
    emit('addNote', pendingHighlight.value);
  }
  noteEditorVisible.value = false;
  pendingHighlight.value = null;
}

function handleNoteClose() {
  noteEditorVisible.value = false;
  pendingHighlight.value = null;
}

onMounted(() => {
  document.addEventListener('selectionchange', handleSelectionChange);
});

onUnmounted(() => {
  document.removeEventListener('selectionchange', handleSelectionChange);
});
</script>

<style scoped>
.selection-toolbar {
  position: absolute;
  z-index: var(--z-toast);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-3);
  border: 1px solid var(--gray-200);
  transform: translateX(-50%);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--radius-1);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-standard);
}

.toolbar-btn:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.toolbar-btn:active {
  transform: scale(0.95);
}

.color-btn {
  position: relative;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--gray-300);
}

.color-btn:hover .color-dot {
  transform: scale(1.2);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--gray-200);
  margin: 0 var(--space-1);
}

.toolbar-fade-enter-active,
.toolbar-fade-leave-active {
  transition: opacity var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
}

.toolbar-fade-enter-from,
.toolbar-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}
</style>
