<template>
  <NModal
    :show="visible"
    preset="dialog"
    :title="title"
    :positive-text="saveText"
    :negative-text="cancelText"
    @positive-click="handleSave"
    @negative-click="handleClose"
    @close="handleClose"
  >
    <div class="note-editor">
      <div v-if="highlight" class="highlight-preview">
        <div class="preview-label">高亮内容</div>
        <blockquote class="preview-text">
          <span
            class="highlight-color-indicator"
            :style="{ backgroundColor: colorMap[highlight.color] }"
          ></span>
          {{ highlight.text }}
        </blockquote>
      </div>

      <div class="markdown-toolbar">
        <button
          v-for="tool in markdownTools"
          :key="tool.action"
          class="toolbar-btn"
          :title="tool.label"
          @click="insertMarkdown(tool.action)"
        >
          <component :is="tool.icon" :size="16" />
        </button>
      </div>

      <NInput
        v-model:value="noteContent"
        type="textarea"
        placeholder="在此编写笔记内容，支持 Markdown 语法..."
        :rows="8"
        :autosize="{ minRows: 8, maxRows: 12 }"
        class="note-textarea"
      />
    </div>
  </NModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Bold, Italic, Heading2, Link, List, Quote } from "lucide-vue-next";
import { NModal, NInput } from "naive-ui";
import type { HighlightAnnotation } from "@/features/reader/stores/readerBookmarks";

interface MarkdownTool {
  action: string;
  label: string;
  icon: typeof Bold;
  prefix: string;
  suffix: string;
  placeholder: string;
}

const markdownTools: MarkdownTool[] = [
  {
    action: "bold",
    label: "粗体",
    icon: Bold,
    prefix: "**",
    suffix: "**",
    placeholder: "粗体文字",
  },
  {
    action: "italic",
    label: "斜体",
    icon: Italic,
    prefix: "*",
    suffix: "*",
    placeholder: "斜体文字",
  },
  {
    action: "heading",
    label: "标题",
    icon: Heading2,
    prefix: "## ",
    suffix: "",
    placeholder: "标题",
  },
  {
    action: "link",
    label: "链接",
    icon: Link,
    prefix: "[",
    suffix: "](url)",
    placeholder: "链接文字",
  },
  { action: "list", label: "列表", icon: List, prefix: "- ", suffix: "", placeholder: "列表项" },
  {
    action: "quote",
    label: "引用",
    icon: Quote,
    prefix: "> ",
    suffix: "",
    placeholder: "引用内容",
  },
];

const colorMap: Record<string, string> = {
  yellow: "#fef08a",
  blue: "#93c5fd",
  green: "#86efac",
  pink: "#f9a8d4",
};

const props = defineProps<{
  visible: boolean;
  highlight: HighlightAnnotation | null;
  onSave?: (note: string) => void;
  onClose?: () => void;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  save: [note: string];
  close: [];
}>();

const title = "添加笔记";
const saveText = "保存";
const cancelText = "取消";

const noteContent = ref("");

const visible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

watch(
  () => props.highlight,
  (newHighlight) => {
    if (newHighlight) {
      noteContent.value = newHighlight.note || "";
    } else {
      noteContent.value = "";
    }
  },
  { immediate: true },
);

function insertMarkdown(action: string) {
  const tool = markdownTools.find((t) => t.action === action);
  if (!tool) return;

  const textarea = document.querySelector(".note-textarea textarea") as HTMLTextAreaElement;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = noteContent.value.substring(start, end);
  const textToInsert = selectedText || tool.placeholder;

  const newText =
    noteContent.value.substring(0, start) +
    tool.prefix +
    textToInsert +
    tool.suffix +
    noteContent.value.substring(end);

  noteContent.value = newText;

  setTimeout(() => {
    textarea.focus();
    const newCursorPos = start + tool.prefix.length + textToInsert.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
}

function handleSave() {
  const note = noteContent.value.trim();
  emit("save", note);
  if (props.onSave) {
    props.onSave(note);
  }
  handleClose();
}

function handleClose() {
  visible.value = false;
  emit("close");
  if (props.onClose) {
    props.onClose();
  }
}
</script>

<style scoped>
.note-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.highlight-preview {
  background: var(--gray-50);
  border-radius: var(--radius-2);
  padding: var(--space-3);
}

.preview-label {
  font-size: var(--fs-12);
  color: var(--gray-500);
  margin-bottom: var(--space-2);
  font-weight: var(--fw-medium);
}

.preview-text {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2);
  background: var(--gray-0);
  border-left: 3px solid var(--gray-300);
  border-radius: var(--radius-1);
  font-size: var(--fs-14);
  color: var(--gray-700);
  line-height: var(--lh-relaxed);
}

.highlight-color-indicator {
  flex-shrink: 0;
  width: 4px;
  height: 100%;
  min-height: 1.2em;
  border-radius: 2px;
  margin-top: 2px;
}

.markdown-toolbar {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--gray-50);
  border-radius: var(--radius-1);
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
  color: var(--gray-600);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-standard);
}

.toolbar-btn:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.toolbar-btn:active {
  transform: scale(0.95);
}

.note-textarea {
  font-family: var(--font-mono);
  font-size: var(--fs-14);
}
</style>
