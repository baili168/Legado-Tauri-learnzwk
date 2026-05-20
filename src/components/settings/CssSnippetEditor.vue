<script setup lang="ts">
defineOptions({ name: 'CssSnippetEditor' });

import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useMessage } from 'naive-ui';

interface CssSnippet {
  id: string;
  name: string;
  css: string;
  enabled: boolean;
}

const STORAGE_KEY = 'legado-user-css-snippets';
const message = useMessage();

const snippets = ref<CssSnippet[]>([]);
const showAddDialog = ref(false);
const newSnippetName = ref('');

function generateId(): string {
  return 'css-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

function loadSnippets(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      snippets.value = JSON.parse(raw) as CssSnippet[];
    }
  } catch {
    snippets.value = [];
  }
}

function saveSnippets(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets.value));
  } catch {}
}

function injectStyle(snippet: CssSnippet): void {
  const styleId = `legado-user-snippet-${snippet.id}`;
  removeStyle(snippet.id);
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.dataset.snippetId = snippet.id;
  styleEl.textContent = snippet.css;
  document.head.appendChild(styleEl);
}

function removeStyle(snippetId: string): void {
  const styleId = `legado-user-snippet-${snippetId}`;
  const existing = document.getElementById(styleId);
  if (existing) {
    existing.remove();
  }
}

function toggleSnippet(snippet: CssSnippet, enabled: boolean): void {
  snippet.enabled = enabled;
  if (enabled) {
    injectStyle(snippet);
  } else {
    removeStyle(snippet.id);
  }
  saveSnippets();
}

function addSnippet(): void {
  const name = newSnippetName.value.trim();
  if (!name) {
    message.warning('请输入片段名称');
    return;
  }
  const snippet: CssSnippet = {
    id: generateId(),
    name,
    css: '',
    enabled: false,
  };
  snippets.value.push(snippet);
  saveSnippets();
  newSnippetName.value = '';
  showAddDialog.value = false;
}

function deleteSnippet(snippetId: string): void {
  removeStyle(snippetId);
  snippets.value = snippets.value.filter((s) => s.id !== snippetId);
  saveSnippets();
}

function onCssInputChange(snippet: CssSnippet): void {
  if (snippet.enabled) {
    injectStyle(snippet);
  }
  saveSnippets();
}

let _unwatchEnabled: (() => void) | null = null;

onMounted(() => {
  loadSnippets();
  for (const snippet of snippets.value) {
    if (snippet.enabled) {
      injectStyle(snippet);
    }
  }
  _unwatchEnabled = watch(
    () => snippets.value.map((s) => ({ id: s.id, enabled: s.enabled, css: s.css })),
    () => {
      for (const snippet of snippets.value) {
        if (snippet.enabled) {
          injectStyle(snippet);
        } else {
          removeStyle(snippet.id);
        }
      }
    },
    { deep: true },
  );
});

onUnmounted(() => {
  for (const snippet of snippets.value) {
    removeStyle(snippet.id);
  }
  _unwatchEnabled?.();
});

function highlightCSS(css: string): string {
  const escaped = css
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(
      /([a-zA-Z-]+)(?=\s*:)/g,
      '<span class="css-prop">$1</span>',
    )
    .replace(
      /(:\s*)([^;{}]+?)(?=\s*[;}])/g,
      (_, colon, value) =>
        colon + '<span class="css-val">' + value + '</span>',
    )
    .replace(
      /(\/\/[^\n]*)/g,
      '<span class="css-comment">$1</span>',
    )
    .replace(
      /(\/\*[\s\S]*?\*\/)/g,
      '<span class="css-comment">$1</span>',
    )
    .replace(
      /([.#@][a-zA-Z0-9_-]+)/g,
      '<span class="css-selector">$1</span>',
    );
}

const snippetTextareas = ref<Record<string, HTMLTextAreaElement | null>>({});
</script>

<template>
  <div class="css-snippet-editor">
    <div class="css-snippet-header">
      <h3 class="css-snippet-title">CSS 片段</h3>
      <n-button size="small" type="primary" @click="showAddDialog = true">
        添加片段
      </n-button>
    </div>

    <div v-if="snippets.length === 0" class="css-snippet-empty">
      暂无 CSS 片段，点击"添加片段"创建
    </div>

    <div v-for="snippet in snippets" :key="snippet.id" class="css-snippet-item">
      <div class="css-snippet-item-header">
        <n-input
          v-model:value="snippet.name"
          size="small"
          placeholder="片段名称"
          class="css-snippet-name-input"
          @update:value="saveSnippets"
        />
        <div class="css-snippet-item-actions">
          <n-switch
            :value="snippet.enabled"
            size="small"
            @update:value="(v: boolean) => toggleSnippet(snippet, v)"
          />
          <n-button
            size="tiny"
            type="error"
            quaternary
            @click="deleteSnippet(snippet.id)"
          >
            删除
          </n-button>
        </div>
      </div>

      <div class="css-snippet-editor-area">
        <div class="css-snippet-code-bg">
          <div
            class="css-snippet-highlight"
            v-html="highlightCSS(snippet.css)"
          />
        </div>
        <textarea
          :ref="(el) => { if (el) snippetTextareas[snippet.id] = el as HTMLTextAreaElement }"
          v-model="snippet.css"
          class="css-snippet-textarea"
          spellcheck="false"
          @input="onCssInputChange(snippet)"
          @scroll="(e: Event) => {
            const target = e.target as HTMLTextAreaElement;
            const highlight = target.previousElementSibling?.querySelector('.css-snippet-highlight') as HTMLElement | null;
            if (highlight) {
              highlight.scrollTop = target.scrollTop;
              highlight.scrollLeft = target.scrollLeft;
            }
          }"
        />
      </div>
    </div>

    <n-modal
      :show="showAddDialog"
      preset="card"
      title="添加 CSS 片段"
      :mask-closable="true"
      @update:show="(v: boolean) => { if (!v) showAddDialog = false; }"
      :style="{ width: '400px', maxWidth: 'calc(100vw - 32px)' }"
    >
      <n-input
        v-model:value="newSnippetName"
        placeholder="片段名称"
        @keydown.enter="addSnippet"
      />
      <template #footer>
        <div class="css-snippet-modal-footer">
          <n-button @click="showAddDialog = false">取消</n-button>
          <n-button type="primary" @click="addSnippet">添加</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.css-snippet-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.css-snippet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.css-snippet-title {
  margin: 0;
  font-size: var(--fs-15);
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.css-snippet-empty {
  padding: var(--space-6);
  text-align: center;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

.css-snippet-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.css-snippet-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.css-snippet-name-input {
  flex: 1;
  min-width: 0;
}

.css-snippet-item-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.css-snippet-editor-area {
  position: relative;
  min-height: 120px;
}

.css-snippet-code-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #1e1e2e;
  border-radius: var(--radius-sm);
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: var(--fs-12);
  line-height: var(--lh-normal);
}

.css-snippet-highlight {
  padding: var(--space-2);
  white-space: pre-wrap;
  word-break: break-all;
  color: #cdd6f4;
  min-height: 100%;
}

.css-snippet-textarea {
  position: relative;
  width: 100%;
  min-height: 120px;
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: transparent;
  caret-color: #f5e0dc;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: var(--fs-12);
  line-height: var(--lh-normal);
  resize: vertical;
  outline: none;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
}

.css-snippet-textarea::selection {
  background: rgba(137, 180, 250, 0.3);
}

.css-snippet-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

:deep(.css-prop) {
  color: #89b4fa;
}

:deep(.css-val) {
  color: #a6e3a1;
}

:deep(.css-comment) {
  color: #6c7086;
  font-style: italic;
}

:deep(.css-selector) {
  color: #f9e2af;
}
</style>