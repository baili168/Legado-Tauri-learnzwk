<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useMessage } from "naive-ui";
import {
  Search,
  Link,
  Wand2,
  Trash2,
  Plus,
  Copy,
  Play,
  Save,
  FileCode,
  BookOpen,
  Film,
  Music,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from "lucide-vue-next";
import { invokeWithTimeout } from "@/composables/useInvoke";
import { saveBookSource, toSafeFileName, type BookSourceMeta } from "@/composables/useBookSource";

const props = defineProps<{
  sources: BookSourceMeta[];
}>();

const emit = defineEmits<{
  reload: [];
}>();

const message = useMessage();

// ── 步骤枚举 ────────────────────────────────────────────────────────────
type WizardStep = "input" | "progress" | "result" | "preview";

const STEPS = [
  { key: "connecting", label: "连接中", description: "正在连接到目标网站..." },
  { key: "loading", label: "加载中", description: "正在加载页面内容..." },
  { key: "domAnalysis", label: "DOM分析", description: "分析页面结构与内容区域..." },
  { key: "typeRecognition", label: "类型识别", description: "识别网站内容类型..." },
  { key: "adFiltering", label: "广告过滤", description: "检测并过滤广告元素..." },
  { key: "codeGeneration", label: "代码生成", description: "生成书源 JS 代码..." },
] as const;

type AnalysisStepKey = (typeof STEPS)[number]["key"];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  novel: "小说",
  comic: "漫画",
  video: "视频",
  audio: "音频/有声书",
};

const CONTENT_TYPE_ICONS: Record<string, any> = {
  novel: BookOpen,
  comic: FileCode,
  video: Film,
  audio: Music,
};

// ── 当前步骤 ─────────────────────────────────────────────────────────────
const currentStep = ref<WizardStep>("input");

// ── URL 输入 ─────────────────────────────────────────────────────────────
const targetUrl = ref("");
const sampleUrls = ref<string[]>([]);
const samplesExpanded = ref(false);
const MAX_SAMPLE_URLS = 3;

function addSampleUrl() {
  if (sampleUrls.value.length >= MAX_SAMPLE_URLS) {
    return;
  }
  sampleUrls.value.push("");
}

function removeSampleUrl(index: number) {
  sampleUrls.value.splice(index, 1);
}

// ── 分析状态 ─────────────────────────────────────────────────────────────
const analyzing = ref(false);
const currentAnalysisStep = ref(-1);
const analysisStepKey = ref<AnalysisStepKey>("connecting");
const showSlowHint = ref(false);
let slowHintTimer: ReturnType<typeof setTimeout> | null = null;

const isStepCompleted = (index: number) => index < currentAnalysisStep.value;
const isStepActive = (index: number) => index === currentAnalysisStep.value;

// ── 分析结果 ─────────────────────────────────────────────────────────────
interface DetectedAdElement {
  selector: string;
  reason: string;
}

interface ExtractedSelector {
  purpose: string;
  selector: string;
  confidence: number;
}

interface AnalysisResult {
  siteName: string;
  contentLabel: string;
  contentType: string;
  confidence: number;
  adElements: DetectedAdElement[];
  selectors: ExtractedSelector[];
  generatedCode: string;
}

const analysisResult = ref<AnalysisResult | null>(null);

// ── 选择器编辑 ───────────────────────────────────────────────────────────
const editingSelectorIndex = ref<number | null>(null);
const editSelectorValue = ref("");

function startEditSelector(index: number) {
  editingSelectorIndex.value = index;
  editSelectorValue.value = analysisResult.value?.selectors[index]?.selector ?? "";
  nextTick(() => {
    const el = document.getElementById(`selector-edit-${index}`);
    if (el) {
      (el as HTMLInputElement).focus();
    }
  });
}

function confirmEditSelector(index: number) {
  if (!analysisResult.value) {
    return;
  }
  const trimmed = editSelectorValue.value.trim();
  if (trimmed) {
    analysisResult.value.selectors[index] = {
      ...analysisResult.value.selectors[index],
      selector: trimmed,
    };
  }
  editingSelectorIndex.value = null;
}

function cancelEditSelector() {
  editingSelectorIndex.value = null;
}

// ── 代码预览 ─────────────────────────────────────────────────────────────
const sourceName = ref("");

// ── 生成代码（模拟分析流程）─────────────────────────────────────────────
function generateBookSourceCode(result: AnalysisResult): string {
  const selectors = result.selectors;
  const getSelector = (purpose: string) =>
    selectors.find((s) => s.purpose === purpose)?.selector ?? "";

  return `// @name        ${result.siteName}
// @version     1.0.0
// @author      Smart Detector
// @url         ${targetUrl.value}
// @logo        default
// @enabled     true
// @tags        ${result.contentLabel},智能识别
// @description 由智能源识别系统从 ${new URL(targetUrl.value).hostname} 自动生成
// @sourceType  ${result.contentType}

const BASE_URL = '${targetUrl.value.replace(/\/+$/, "")}'

async function search(key, page) {
  const resp = await legado.http.get(
    \`\${BASE_URL}${getSelector("search") || "/search?keyword={keyword}"}\`
  )
  const doc = new DOMParser().parseFromString(resp, 'text/html')
  const items = doc.querySelectorAll('${getSelector("searchList") || ".search-list li"}')
  return Array.from(items).map(item => ({
    name:    item.querySelector('${getSelector("searchName") || "h3"}')?.textContent?.trim() ?? '',
    author:  item.querySelector('${getSelector("searchAuthor") || ".author"}')?.textContent?.trim() ?? '',
    coverUrl: item.querySelector('${getSelector("searchCover") || "img"}')?.getAttribute('src') ?? '',
    intro:   item.querySelector('${getSelector("searchIntro") || ".intro"}')?.textContent?.trim() ?? '',
    bookUrl: item.querySelector('${getSelector("searchLink") || "a"}')?.getAttribute('href') ?? '',
  }))
}

async function bookInfo(bookUrl) {
  const resp = await legado.http.get(bookUrl)
  const doc = new DOMParser().parseFromString(resp, 'text/html')
  return {
    name:     doc.querySelector('${getSelector("bookName") || "h1"}')?.textContent?.trim() ?? '',
    author:   doc.querySelector('${getSelector("bookAuthor") || ".author"}')?.textContent?.trim() ?? '',
    coverUrl: doc.querySelector('${getSelector("bookCover") || ".cover img"}')?.getAttribute('src') ?? '',
    intro:    doc.querySelector('${getSelector("bookIntro") || ".intro"}')?.textContent?.trim() ?? '',
    bookUrl,
    tocUrl:   bookUrl,
  }
}

async function toc(tocUrl) {
  const resp = await legado.http.get(tocUrl)
  const doc = new DOMParser().parseFromString(resp, 'text/html')
  const chapters = doc.querySelectorAll('${getSelector("tocList") || ".chapter-list li"}')
  return Array.from(chapters).map(ch => ({
    name: ch.querySelector('${getSelector("tocName") || "a"}')?.textContent?.trim() ?? '',
    url:  ch.querySelector('${getSelector("tocLink") || "a"}')?.getAttribute('href') ?? '',
  }))
}

async function content(chapterUrl) {
  const resp = await legado.http.get(chapterUrl)
  const doc = new DOMParser().parseFromString(resp, 'text/html')
  return doc.querySelector('${getSelector("content") || ".content"}')?.textContent?.trim() ?? ''
}
`;
}

// ── 启动分析 ─────────────────────────────────────────────────────────────
async function startAnalysis() {
  const url = targetUrl.value.trim();
  if (!url) {
    message.warning("请输入目标网址");
    return;
  }

  try {
    new URL(url);
  } catch {
    message.warning("请输入有效的 URL 地址");
    return;
  }

  currentStep.value = "progress";
  analyzing.value = true;
  currentAnalysisStep.value = 0;
  analysisStepKey.value = "connecting";
  showSlowHint.value = false;

  slowHintTimer = setTimeout(() => {
    showSlowHint.value = true;
  }, 30000);

  try {
    const allUrls = [url, ...sampleUrls.value.map((u) => u.trim()).filter(Boolean)];

    for (let i = 0; i < STEPS.length; i++) {
      currentAnalysisStep.value = i;
      analysisStepKey.value = STEPS[i].key;

      const delay = 800 + Math.random() * 1200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const contentType = Math.random() > 0.5 ? "novel" : "comic";
    const baseName = hostname.split(".")[0] || hostname;

    const mockResult: AnalysisResult = {
      siteName: baseName.charAt(0).toUpperCase() + baseName.slice(1),
      contentLabel: CONTENT_TYPE_LABELS[contentType] ?? contentType,
      contentType,
      confidence: 0.78 + Math.random() * 0.15,
      adElements: [
        { selector: ".ad-banner", reason: "匹配常见广告类名 ad-banner" },
        { selector: '[class*="popup"]', reason: "包含 popup 关键字，疑似弹窗广告" },
        { selector: ".float-ad", reason: "匹配浮动广告选择器 .float-ad" },
        { selector: 'iframe[src*="ad"]', reason: "检测到广告 iframe 嵌入" },
      ],
      selectors: [
        { purpose: "search", selector: "/search?keyword={keyword}", confidence: 0.92 },
        { purpose: "searchList", selector: ".result-list li", confidence: 0.88 },
        { purpose: "searchName", selector: "h3.title", confidence: 0.85 },
        { purpose: "searchAuthor", selector: ".author", confidence: 0.8 },
        { purpose: "searchCover", selector: "img.cover", confidence: 0.78 },
        { purpose: "searchIntro", selector: ".desc", confidence: 0.75 },
        { purpose: "searchLink", selector: "a", confidence: 0.95 },
        { purpose: "tocList", selector: ".chapter-list li", confidence: 0.86 },
        { purpose: "tocName", selector: "a", confidence: 0.9 },
        { purpose: "tocLink", selector: "a", confidence: 0.9 },
        { purpose: "content", selector: "#content", confidence: 0.82 },
        { purpose: "bookName", selector: "h1", confidence: 0.85 },
        { purpose: "bookAuthor", selector: ".author", confidence: 0.8 },
        { purpose: "bookCover", selector: ".cover img", confidence: 0.76 },
        { purpose: "bookIntro", selector: ".intro", confidence: 0.72 },
      ],
      generatedCode: "",
    };

    mockResult.generatedCode = generateBookSourceCode(mockResult);
    analysisResult.value = mockResult;
    sourceName.value = `${hostname.replace(/\./g, "_")}_${contentType}.js`;

    currentAnalysisStep.value = STEPS.length;
    await new Promise((resolve) => setTimeout(resolve, 400));
    currentStep.value = "result";
  } catch (e: unknown) {
    message.error(`分析失败：${e instanceof Error ? e.message : String(e)}`);
    currentStep.value = "input";
  } finally {
    analyzing.value = false;
    if (slowHintTimer) {
      clearTimeout(slowHintTimer);
      slowHintTimer = null;
    }
  }
}

// ── 重新分析 ─────────────────────────────────────────────────────────────
function reanalyze() {
  analysisResult.value = null;
  currentStep.value = "input";
}

// ── 确认并生成代码 ───────────────────────────────────────────────────────
function confirmAndGenerate() {
  if (!analysisResult.value) {
    return;
  }
  analysisResult.value.generatedCode = generateBookSourceCode(analysisResult.value);
  currentStep.value = "preview";
}

// ── 复制代码 ─────────────────────────────────────────────────────────────
async function copyCode() {
  const code = analysisResult.value?.generatedCode;
  if (!code) {
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    message.success("已复制到剪贴板");
  } catch {
    message.error("复制失败");
  }
}

// ── 测试书源 ─────────────────────────────────────────────────────────────
const testing = ref(false);

async function testSource() {
  if (!analysisResult.value) {
    return;
  }
  testing.value = true;
  const fileName = sourceName.value || toSafeFileName(analysisResult.value.siteName);
  try {
    await saveBookSource(fileName, analysisResult.value.generatedCode);
    await invokeWithTimeout("booksource_test", { fileName }, 60000);
    message.success("测试完成");
  } catch (e: unknown) {
    message.error(`测试失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    testing.value = false;
  }
}

// ── 保存书源 ─────────────────────────────────────────────────────────────
const saving = ref(false);

async function saveSource() {
  if (!analysisResult.value) {
    return;
  }
  saving.value = true;
  const fileName = sourceName.value || toSafeFileName(analysisResult.value.siteName);
  try {
    await saveBookSource(fileName, analysisResult.value.generatedCode);
    await invokeWithTimeout("booksource_compile_to_installed", { fileName }, 20000).catch(() => {});
    emit("reload");
    message.success(`书源「${fileName}」保存成功`);
    currentStep.value = "input";
    targetUrl.value = "";
    sampleUrls.value = [];
    analysisResult.value = null;
  } catch (e: unknown) {
    message.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    saving.value = false;
  }
}

// ── 计算属性 ─────────────────────────────────────────────────────────────
const canAddSampleUrl = computed(() => sampleUrls.value.length < MAX_SAMPLE_URLS);

const contentTypeIcon = computed(() => {
  if (!analysisResult.value) {
    return BookOpen;
  }
  return CONTENT_TYPE_ICONS[analysisResult.value.contentType] ?? BookOpen;
});

const expandedAdElements = ref<Set<number>>(new Set());

function toggleAdElement(index: number) {
  const next = new Set(expandedAdElements.value);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  expandedAdElements.value = next;
}

const stepDisplay = computed(() =>
  STEPS.map((step, index) => ({
    ...step,
    status: isStepCompleted(index)
      ? ("finish" as const)
      : isStepActive(index)
        ? ("process" as const)
        : ("wait" as const),
  })),
);

const currentStepDescription = computed(() => {
  const idx = currentAnalysisStep.value;
  if (idx >= 0 && idx < STEPS.length) {
    return STEPS[idx].description;
  }
  return "";
});
</script>

<template>
  <div class="smart-detector">
    <n-card class="detector-card" :bordered="false">
      <!-- ── 步骤 1: URL 输入 ────────────────────────────── -->
      <template v-if="currentStep === 'input'">
        <div class="step-header">
          <div class="step-icon">
            <Link :size="20" />
          </div>
          <div class="step-title-group">
            <h3 class="step-title">输入目标网址</h3>
            <p class="step-desc">粘贴小说、漫画或视频网站的页面地址，智能识别内容结构</p>
          </div>
        </div>

        <div class="url-input-section">
          <div class="url-input-row">
            <n-input
              v-model:value="targetUrl"
              size="large"
              placeholder="https://example.com"
              :input-props="{ type: 'url', autocomplete: 'url' }"
              clearable
              class="url-input-main"
            >
              <template #prefix>
                <Link :size="16" class="url-input-icon" />
              </template>
            </n-input>
          </div>

          <div class="samples-toggle">
            <n-button text size="small" @click="samplesExpanded = !samplesExpanded">
              <template #icon>
                <ChevronRight v-if="!samplesExpanded" :size="14" />
                <ChevronDown v-else :size="14" />
              </template>
              添加样本 URL（{{ sampleUrls.length }}/{{ MAX_SAMPLE_URLS }}）
            </n-button>
          </div>

          <n-collapse-transition :show="samplesExpanded">
            <div class="sample-urls">
              <div v-for="(url, index) in sampleUrls" :key="index" class="sample-url-row">
                <n-input
                  v-model:value="sampleUrls[index]"
                  size="small"
                  placeholder="https://example.com/another-page"
                  class="sample-url-input"
                  clearable
                />
                <n-button size="tiny" quaternary type="error" @click="removeSampleUrl(index)">
                  <template #icon>
                    <Trash2 :size="14" />
                  </template>
                </n-button>
              </div>
              <n-button v-if="canAddSampleUrl" size="small" dashed @click="addSampleUrl">
                <template #icon>
                  <Plus :size="14" />
                </template>
                添加样本 URL
              </n-button>
              <div v-if="sampleUrls.length > 0" class="samples-hint">
                添加更多 URL 可提高域名规则和内容结构的识别准确度
              </div>
            </div>
          </n-collapse-transition>
        </div>

        <div class="step-footer">
          <n-button
            type="primary"
            size="large"
            :disabled="!targetUrl.trim() || analyzing"
            @click="startAnalysis"
          >
            <template #icon>
              <Search :size="18" />
            </template>
            开始分析
          </n-button>
        </div>
      </template>

      <!-- ── 步骤 2: 分析进度 ────────────────────────────── -->
      <template v-else-if="currentStep === 'progress'">
        <div class="step-header">
          <div class="step-icon step-icon--spinning">
            <Wand2 :size="20" />
          </div>
          <div class="step-title-group">
            <h3 class="step-title">正在分析网站结构</h3>
            <p class="step-desc">{{ currentStepDescription }}</p>
          </div>
        </div>

        <div class="progress-section">
          <n-steps
            vertical
            :current="currentAnalysisStep"
            :status="analyzing ? 'process' : 'finish'"
          >
            <n-step
              v-for="(step, index) in stepDisplay"
              :key="step.key"
              :title="step.label"
              :description="step.description"
              :status="step.status"
            />
          </n-steps>

          <div v-if="showSlowHint" class="slow-hint">
            <AlertCircle :size="16" />
            <span>分析时间较长，请耐心等待</span>
          </div>
        </div>
      </template>

      <!-- ── 步骤 3: 分析结果确认 ────────────────────────── -->
      <template v-else-if="currentStep === 'result' && analysisResult">
        <div class="step-header">
          <div class="step-icon step-icon--success">
            <CheckCircle :size="20" />
          </div>
          <div class="step-title-group">
            <h3 class="step-title">分析结果</h3>
            <p class="step-desc">请确认识别结果，可编辑选择器后生成书源代码</p>
          </div>
        </div>

        <!-- 结果卡片 -->
        <div class="result-summary-card">
          <div class="result-site-row">
            <component :is="contentTypeIcon" :size="28" class="result-type-icon" />
            <div class="result-site-info">
              <div class="result-site-name">{{ analysisResult.siteName }}</div>
              <div class="result-site-meta">
                <n-tag size="small" round type="info">
                  {{ analysisResult.contentLabel }}
                </n-tag>
                <span class="result-site-url">{{ targetUrl }}</span>
              </div>
            </div>
          </div>
          <div class="result-confidence-row">
            <span class="confidence-label">置信度</span>
            <n-progress
              type="line"
              :percentage="Math.round(analysisResult.confidence * 100)"
              :height="8"
              :border-radius="4"
              :fill-border-radius="4"
              :color="
                analysisResult.confidence >= 0.85
                  ? '#18a058'
                  : analysisResult.confidence >= 0.7
                    ? '#f0a020'
                    : '#d03050'
              "
              :indicator-placement="'inside'"
              :show-indicator="true"
              indicator-text-color="#fff"
            />
            <span class="confidence-value">{{ Math.round(analysisResult.confidence * 100) }}%</span>
          </div>
        </div>

        <!-- 检测到的广告元素 -->
        <n-collapse class="result-collapse">
          <n-collapse-item title="检测到的广告元素" name="ads">
            <template #header-extra>
              <n-tag size="tiny" round>{{ analysisResult.adElements.length }} 个</n-tag>
            </template>
            <div class="ad-elements-list">
              <div
                v-for="(ad, index) in analysisResult.adElements"
                :key="index"
                class="ad-element-item"
              >
                <div class="ad-element-header" @click="toggleAdElement(index)">
                  <div class="ad-element-selector">
                    <code>{{ ad.selector }}</code>
                  </div>
                  <ChevronRight
                    :size="14"
                    class="ad-element-chevron"
                    :class="{ 'ad-element-chevron--expanded': expandedAdElements.has(index) }"
                  />
                </div>
                <n-collapse-transition :show="expandedAdElements.has(index)">
                  <div class="ad-element-detail">
                    <div class="ad-element-reason-label">过滤原因</div>
                    <div class="ad-element-reason">{{ ad.reason }}</div>
                  </div>
                </n-collapse-transition>
              </div>
              <div v-if="analysisResult.adElements.length === 0" class="ad-elements-empty">
                未检测到广告元素
              </div>
            </div>
          </n-collapse-item>
        </n-collapse>

        <!-- 提取的选择器 -->
        <div class="selectors-section">
          <div class="selectors-header">
            <h4 class="selectors-title">提取的选择器</h4>
            <n-tag size="tiny" round>{{ analysisResult.selectors.length }} 个</n-tag>
          </div>
          <div class="selectors-table">
            <div class="selectors-table-header">
              <span class="sel-col-purpose">用途</span>
              <span class="sel-col-selector">选择器</span>
              <span class="sel-col-confidence">置信度</span>
              <span class="sel-col-action">操作</span>
            </div>
            <div
              v-for="(sel, index) in analysisResult.selectors"
              :key="index"
              class="selectors-table-row"
            >
              <div class="sel-col-purpose">
                <n-tag size="tiny" round :bordered="false">
                  {{ sel.purpose }}
                </n-tag>
              </div>
              <div class="sel-col-selector">
                <template v-if="editingSelectorIndex === index">
                  <input
                    :id="`selector-edit-${index}`"
                    v-model="editSelectorValue"
                    class="selector-edit-input"
                    @blur="confirmEditSelector(index)"
                    @keydown.enter="confirmEditSelector(index)"
                    @keydown.escape="cancelEditSelector"
                  />
                </template>
                <code v-else class="selector-value" @click="startEditSelector(index)">
                  {{ sel.selector }}
                </code>
              </div>
              <div class="sel-col-confidence">
                <n-progress
                  type="line"
                  :percentage="Math.round(sel.confidence * 100)"
                  :height="6"
                  :border-radius="3"
                  :fill-border-radius="3"
                  :show-indicator="false"
                  :color="
                    sel.confidence >= 0.85
                      ? '#18a058'
                      : sel.confidence >= 0.7
                        ? '#f0a020'
                        : '#d03050'
                  "
                />
                <span class="sel-confidence-text">{{ Math.round(sel.confidence * 100) }}%</span>
              </div>
              <div class="sel-col-action">
                <n-button size="tiny" quaternary @click="startEditSelector(index)"> 编辑 </n-button>
              </div>
            </div>
          </div>
        </div>

        <div class="step-footer step-footer--actions">
          <n-button size="large" @click="reanalyze"> 重新分析 </n-button>
          <n-button type="primary" size="large" @click="confirmAndGenerate">
            <template #icon>
              <FileCode :size="18" />
            </template>
            确认并生成书源
          </n-button>
        </div>
      </template>

      <!-- ── 步骤 4: 代码预览与测试 ──────────────────────── -->
      <template v-else-if="currentStep === 'preview' && analysisResult">
        <div class="step-header">
          <div class="step-icon step-icon--success">
            <FileCode :size="20" />
          </div>
          <div class="step-title-group">
            <h3 class="step-title">书源代码预览</h3>
            <p class="step-desc">检查生成的代码，可编辑书源名称</p>
          </div>
        </div>

        <div class="preview-name-row">
          <span class="preview-name-label">书源名称</span>
          <n-input
            v-model:value="sourceName"
            size="small"
            placeholder="自动生成..."
            class="preview-name-input"
          />
        </div>

        <div class="code-preview-wrapper">
          <div class="code-preview-toolbar">
            <span class="code-preview-label">
              <FileCode :size="14" />
              {{ sourceName || "untitled.js" }}
            </span>
            <div class="code-preview-actions">
              <n-button size="tiny" quaternary @click="copyCode">
                <template #icon>
                  <Copy :size="14" />
                </template>
                复制代码
              </n-button>
            </div>
          </div>
          <pre class="code-preview-content"><code>{{ analysisResult.generatedCode }}</code></pre>
        </div>

        <div class="step-footer step-footer--actions">
          <n-button size="large" @click="currentStep = 'result'"> 返回修改 </n-button>
          <n-button size="large" :loading="testing" @click="testSource">
            <template #icon>
              <Play :size="18" />
            </template>
            测试书源
          </n-button>
          <n-button type="primary" size="large" :loading="saving" @click="saveSource">
            <template #icon>
              <Save :size="18" />
            </template>
            保存书源
          </n-button>
        </div>
      </template>
    </n-card>
  </div>
</template>

<style scoped>
/* ── 外层 ── */
.smart-detector {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  justify-content: center;
}

.detector-card {
  width: 100%;
  max-width: 720px;
  align-self: flex-start;
}

/* ── 步骤头部 ── */
.step-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 24px;
}

.step-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  background: var(--color-accent-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
}

.step-icon--spinning {
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.step-icon--success {
  background: color-mix(in srgb, #18a058 15%, transparent);
  color: #18a058;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-accent) 0%, transparent);
  }
}

.step-title-group {
  flex: 1;
  min-width: 0;
}

.step-title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: var(--fw-semibold);
  color: var(--color-text-primary);
}

.step-desc {
  margin: 4px 0 0;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

/* ── URL 输入 ── */
.url-input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.url-input-row {
  width: 100%;
}

.url-input-main {
  width: 100%;
}

.url-input-icon {
  color: var(--color-text-muted);
}

.samples-toggle {
  display: flex;
}

.sample-urls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 0 4px;
}

.sample-url-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sample-url-input {
  flex: 1;
}

.samples-hint {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  padding: 2px 0;
}

/* ── 进度区 ── */
.progress-section {
  padding: 16px 0;
}

.slow-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-warning) 10%, transparent);
  color: var(--color-warning);
  font-size: var(--fs-13);
  border: 1px solid color-mix(in srgb, var(--color-warning) 25%, transparent);
}

/* ── 结果卡片 ── */
.result-summary-card {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  margin-bottom: 16px;
}

.result-site-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}

.result-type-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.result-site-info {
  flex: 1;
  min-width: 0;
}

.result-site-name {
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--color-text-primary);
}

.result-site-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.result-site-url {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.result-confidence-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.confidence-label {
  font-size: var(--fs-12);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.confidence-value {
  font-size: var(--fs-12);
  font-weight: var(--fw-semibold);
  color: var(--color-text-primary);
  flex-shrink: 0;
}

/* ── 折叠面板 ── */
.result-collapse {
  margin-bottom: 16px;
}

.ad-elements-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ad-element-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  overflow: hidden;
}

.ad-element-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.ad-element-header:hover {
  background: var(--color-surface-hover);
}

.ad-element-selector code {
  font-size: var(--fs-12);
  font-family: "Consolas", "Menlo", monospace;
  color: var(--color-text-primary);
}

.ad-element-chevron {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}

.ad-element-chevron--expanded {
  transform: rotate(90deg);
}

.ad-element-detail {
  padding: 6px 12px 10px;
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-danger) 4%, var(--color-surface));
}

.ad-element-reason-label {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.ad-element-reason {
  font-size: var(--fs-12);
  color: var(--color-text-secondary);
}

.ad-elements-empty {
  padding: 16px;
  text-align: center;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

/* ── 选择器表格 ── */
.selectors-section {
  margin-bottom: 24px;
}

.selectors-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.selectors-title {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text-primary);
}

.selectors-table {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.selectors-table-header {
  display: grid;
  grid-template-columns: 100px 1fr 140px 60px;
  padding: 8px 12px;
  background: var(--color-surface-hover);
  font-size: var(--fs-11);
  font-weight: var(--fw-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid var(--color-border);
}

.selectors-table-row {
  display: grid;
  grid-template-columns: 100px 1fr 140px 60px;
  padding: 8px 12px;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--fs-13);
}

.selectors-table-row:last-child {
  border-bottom: none;
}

.sel-col-purpose {
  min-width: 0;
}

.sel-col-selector {
  min-width: 0;
}

.sel-col-confidence {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sel-col-action {
  text-align: right;
}

.selector-value {
  font-size: var(--fs-12);
  font-family: "Consolas", "Menlo", monospace;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: var(--radius-xs);
  transition: background var(--transition-fast);
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-value:hover {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.selector-edit-input {
  font-size: var(--fs-12);
  font-family: "Consolas", "Menlo", monospace;
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-xs);
  padding: 3px 6px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.sel-confidence-text {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* ── 代码预览 ── */
.preview-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.preview-name-label {
  font-size: var(--fs-13);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.preview-name-input {
  flex: 1;
  max-width: 360px;
}

.code-preview-wrapper {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 24px;
}

.code-preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--color-surface-hover);
  border-bottom: 1px solid var(--color-border);
}

.code-preview-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-12);
  font-family: monospace;
  color: var(--color-accent);
  font-weight: var(--fw-semibold);
}

.code-preview-actions {
  display: flex;
  gap: 6px;
}

.code-preview-content {
  margin: 0;
  padding: 16px;
  overflow-y: auto;
  max-height: 420px;
  font-size: var(--fs-12);
  font-family: "Consolas", "Menlo", monospace;
  line-height: 1.65;
  white-space: pre;
  color: var(--color-text-primary);
  background: var(--color-surface);
  tab-size: 2;
}

.code-preview-content code {
  font-family: inherit;
  font-size: inherit;
}

/* ── 步骤底部 ── */
.step-footer {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.step-footer--actions {
  justify-content: flex-end;
  gap: 10px;
}

/* ── 移动端适配 ── */
@media (pointer: coarse), (max-width: 640px) {
  .smart-detector {
    padding: 12px;
  }

  .detector-card {
    max-width: 100%;
  }

  .selectors-table-header,
  .selectors-table-row {
    grid-template-columns: 80px 1fr 90px 40px;
    padding: 6px 8px;
  }

  .step-footer--actions {
    flex-wrap: wrap;
  }

  .code-preview-content {
    max-height: 300px;
  }
}
</style>
