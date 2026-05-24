<script setup lang="ts">
import { ref, watch } from "vue";
import { useMessage } from "naive-ui";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  imported: [payload: { name: string; colors: Record<string, string> }];
}>();

const message = useMessage();

const activeTab = ref("file");
const urlInput = ref("");
const urlLoading = ref(false);
const parsedTheme = ref<{ name: string; colors: Record<string, string> } | null>(null);
const errorMessage = ref("");

function close() {
  emit("update:show", false);
}

function resetState() {
  parsedTheme.value = null;
  errorMessage.value = "";
  urlInput.value = "";
  urlLoading.value = false;
  activeTab.value = "file";
}

watch(
  () => props.show,
  (val) => {
    if (!val) {
      setTimeout(resetState, 200);
    }
  },
);

function validateThemeData(
  data: unknown,
): data is { name: string; colors: Record<string, string> } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim()) return false;
  if (!obj.colors || typeof obj.colors !== "object") return false;
  const colors = obj.colors as Record<string, unknown>;
  if (typeof colors.primary !== "string" || !colors.primary) return false;
  return true;
}

function handleParsedData(data: unknown) {
  if (!validateThemeData(data)) {
    errorMessage.value = "主题数据不完整：缺少 name/colors/primary 字段";
    parsedTheme.value = null;
    return;
  }
  parsedTheme.value = {
    name: data.name,
    colors: data.colors as Record<string, string>,
  };
  errorMessage.value = "";
}

function handleJsonError() {
  errorMessage.value = "JSON 格式无效";
  parsedTheme.value = null;
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string);
      handleParsedData(data);
    } catch {
      handleJsonError();
    }
  };
  reader.onerror = () => {
    errorMessage.value = "文件读取失败";
    parsedTheme.value = null;
  };
  reader.readAsText(file);
  input.value = "";
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string);
      handleParsedData(data);
    } catch {
      handleJsonError();
    }
  };
  reader.onerror = () => {
    errorMessage.value = "文件读取失败";
    parsedTheme.value = null;
  };
  reader.readAsText(file);
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
  fileInputRef.value?.click();
}

async function handleUrlFetch() {
  const url = urlInput.value.trim();
  if (!url) {
    errorMessage.value = "请输入 URL 地址";
    return;
  }

  urlLoading.value = true;
  errorMessage.value = "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      errorMessage.value = "无法连接到该 URL，请检查地址是否正确";
      return;
    }
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      handleParsedData(data);
    } catch {
      handleJsonError();
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      errorMessage.value = "请求超时，请检查网络连接";
    } else {
      errorMessage.value = "无法连接到该 URL，请检查地址是否正确";
    }
  } finally {
    clearTimeout(timeoutId);
    urlLoading.value = false;
  }
}

async function handleClipboardImport() {
  try {
    const text = await navigator.clipboard.readText();
    try {
      const data = JSON.parse(text);
      handleParsedData(data);
    } catch {
      errorMessage.value = "剪贴板内容不是有效的主题 JSON";
      parsedTheme.value = null;
    }
  } catch {
    errorMessage.value = "无法读取剪贴板，请检查浏览器权限";
    parsedTheme.value = null;
  }
}

function confirmImport() {
  if (!parsedTheme.value) return;
  emit("imported", { ...parsedTheme.value });
  close();
}

const COLOR_PALETTE_KEYS = ["primary", "surface", "error", "secondary"] as const;
</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    title="导入主题"
    :mask-closable="true"
    @update:show="(v: boolean) => emit('update:show', v)"
    :style="{ width: '560px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="file" tab="文件导入">
        <div
          class="drop-zone"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @click="triggerFileInput"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            class="drop-zone__input"
            @change="handleFileSelect"
          />
          <p class="drop-zone__text">点击选择或拖拽 .json 主题文件到此处</p>
        </div>
      </n-tab-pane>

      <n-tab-pane name="url" tab="URL 导入">
        <div class="url-import">
          <n-input v-model:value="urlInput" placeholder="https://..." :disabled="urlLoading" />
          <n-button type="primary" :loading="urlLoading" @click="handleUrlFetch"> 获取 </n-button>
        </div>
      </n-tab-pane>

      <n-tab-pane name="clipboard" tab="剪贴板">
        <div class="clipboard-import">
          <n-button @click="handleClipboardImport">读取剪贴板</n-button>
        </div>
      </n-tab-pane>
    </n-tabs>

    <div v-if="errorMessage" class="import-error">
      {{ errorMessage }}
    </div>

    <div v-if="parsedTheme" class="preview-area">
      <div class="preview-area__name">{{ parsedTheme.name }}</div>
      <div class="preview-area__palette">
        <div
          v-for="key in COLOR_PALETTE_KEYS"
          :key="key"
          class="preview-area__swatch"
          :style="{ backgroundColor: parsedTheme.colors[key] || '#ccc' }"
          :title="key"
        />
      </div>
    </div>

    <template #footer>
      <div class="import-footer">
        <n-button @click="close">取消</n-button>
        <n-button v-if="parsedTheme" type="primary" @click="confirmImport"> 确认导入 </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
  position: relative;
}

.drop-zone:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}

.drop-zone__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-zone__text {
  font-size: var(--fs-13);
  color: var(--color-text-muted);
  user-select: none;
  pointer-events: none;
}

.url-import {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.clipboard-import {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg) 0;
}

.import-error {
  margin-top: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  background: var(--color-danger-subtle);
  color: var(--color-danger);
  font-size: var(--fs-13);
}

.preview-area {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.preview-area__name {
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}

.preview-area__palette {
  display: flex;
  gap: var(--space-sm);
}

.preview-area__swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--color-border);
}

.import-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
</style>
