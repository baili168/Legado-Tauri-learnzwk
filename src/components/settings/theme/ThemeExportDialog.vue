<script setup lang="ts">
import { X, Palette, Download, Copy, Link2 } from 'lucide-vue-next';
import { NModal, NCard, NButton, useMessage } from 'naive-ui';
import { computed } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';

const props = defineProps<{
  show: boolean;
  themeId: string;
  themeName: string;
  themeColors: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const message = useMessage();

const exportData = computed(() => ({
  id: props.themeId,
  name: props.themeName,
  colors: props.themeColors,
}));

const jsonStr = computed(() => JSON.stringify(exportData.value, null, 2));

function handleClose() {
  emit('update:show', false);
}

useOverlayBackstack(() => props.show, handleClose);

function handleDownload() {
  const safeName = props.themeName.replace(/\s/g, '_');
  const blob = new Blob([jsonStr.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.legado-theme.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function handleCopyJson() {
  try {
    await navigator.clipboard.writeText(jsonStr.value);
    message.success('已复制到剪贴板');
  } catch {
    message.error('复制失败');
  }
}

async function handleCopyLink() {
  try {
    const base64 = btoa(unescape(encodeURIComponent(jsonStr.value)));
    const link = `legado://theme?data=${base64}`;
    await navigator.clipboard.writeText(link);
    message.success('主题链接已复制到剪贴板');
  } catch {
    message.error('复制链接失败');
  }
}

const previewColors = computed(() => {
  const { primary, surface, error, secondary } = props.themeColors;
  return [
    { label: 'primary', color: primary, value: primary || 'transparent' },
    { label: 'surface', color: surface, value: surface || 'transparent' },
    { label: 'error', color: error, value: error || 'transparent' },
    { label: 'secondary', color: secondary, value: secondary || 'transparent' },
  ];
});
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="true"
    :close-on-esc="true"
    @update:show="(v: boolean) => !v && handleClose()"
    class="theme-export-modal"
  >
    <NCard
      class="theme-export-card"
      :title="`导出主题 — ${themeName}`"
      :bordered="false"
      role="dialog"
      aria-modal="true"
    >
      <template #header-extra>
        <NButton quaternary circle size="small" aria-label="关闭" @click="handleClose">
          <X :size="16" :stroke-width="2.5" />
        </NButton>
      </template>

      <div class="theme-export-body">
        <div class="theme-export-section">
          <div class="theme-export-section__label">
            <Palette :size="14" />
            <span>色板预览</span>
          </div>
          <div class="theme-color-preview">
            <div
              v-for="c in previewColors"
              :key="c.label"
              class="theme-color-swatch"
              :style="{ backgroundColor: c.value }"
              :title="c.color || c.label"
            />
          </div>
        </div>

        <div class="theme-export-section">
          <div class="theme-export-section__label">JSON 预览</div>
          <pre class="theme-json-preview"><code>{{ jsonStr }}</code></pre>
        </div>
      </div>

      <template #footer>
        <div class="theme-export-footer">
          <NButton size="small" @click="handleCopyJson">
            <template #icon>
              <Copy :size="14" />
            </template>
            复制 JSON
          </NButton>
          <NButton size="small" @click="handleCopyLink">
            <template #icon>
              <Link2 :size="14" />
            </template>
            复制主题链接
          </NButton>
          <NButton size="small" type="primary" @click="handleDownload">
            <template #icon>
              <Download :size="14" />
            </template>
            下载 JSON 文件
          </NButton>
        </div>
      </template>
    </NCard>
  </NModal>
</template>

<style scoped>
.theme-export-modal {
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-export-card {
  width: min(520px, calc(100vw - 28px));
  max-height: 92dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.theme-export-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 8px;
  max-height: 60vh;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.theme-export-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-export-section__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.theme-color-preview {
  display: flex;
  gap: 8px;
}

.theme-color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s;
}

.theme-color-swatch:hover {
  transform: scale(1.12);
}

.theme-json-preview {
  margin: 0;
  padding: 12px 14px;
  background: #1e1e2e;
  border-radius: 8px;
  overflow: auto;
  max-height: 280px;
  font-family: var(--font-mono, 'Consolas', 'Menlo', 'Courier New', monospace);
  font-size: var(--fs-12);
  line-height: 1.6;
  color: #cdd6f4;
  user-select: text;
}

.theme-json-preview code {
  white-space: pre-wrap;
  word-break: break-all;
}

.theme-export-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .theme-export-card {
    border-radius: 0;
    width: 100vw;
    max-height: 100dvh;
  }

  .theme-export-footer {
    justify-content: stretch;
  }

  .theme-export-footer :deep(.n-button) {
    flex: 1;
  }
}
</style>