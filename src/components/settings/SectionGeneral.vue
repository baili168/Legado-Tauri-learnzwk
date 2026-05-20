<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, reactive, ref, onMounted, defineAsyncComponent } from 'vue';
import { useAppConfigStore, usePreferencesStore } from '@/stores';
import { useNotification } from '@/composables/useNotification';
import { useMaterialYou } from '@/composables/useMaterialYou';
import type { CustomTheme } from '@/composables/useMaterialYou';
import { useOnlineThemeSource } from '@/composables/useOnlineThemeSource';
import type { ThemeEntry } from '@/composables/useOnlineThemeSource';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const ThemeEditor = defineAsyncComponent(() => import('./theme/ThemeEditor.vue'));
const ThemeImportDialog = defineAsyncComponent(() => import('./theme/ThemeImportDialog.vue'));
const ThemeExportDialog = defineAsyncComponent(() => import('./theme/ThemeExportDialog.vue'));

const _appCfg = useAppConfigStore();
const { config } = storeToRefs(_appCfg);
const { setConfig } = _appCfg;

const prefsStore = usePreferencesStore();
const tocCfg = computed(() => prefsStore.tocAutoUpdate);
const searchCfg = computed(() => prefsStore.search);

const DENSITY_OPTIONS = [
  { label: '紧凑', value: 'compact', desc: '更多内容' },
  { label: '标准', value: 'standard', desc: '默认' },
  { label: '舒适', value: 'comfortable', desc: '更大间距' },
] as const;

const FONT_SCALE_KEY = 'legado-ui-font-scale';
const fontScale = ref<string>(localStorage.getItem(FONT_SCALE_KEY) || 'medium');

function handleFontScaleChange(scale: string) {
  fontScale.value = scale;
  localStorage.setItem(FONT_SCALE_KEY, scale);
  const root = document.documentElement;
  root.setAttribute('data-font-scale', scale);
  const scaleMap: Record<string, string> = { small: '0.875', medium: '1', large: '1.125' };
  root.style.setProperty('--ui-font-scale', scaleMap[scale] || '1');
}

const { scheduleReminder, getReminderConfig, isNotificationSupported, requestPermission } = useNotification();

const reminderState = reactive({
  enabled: false,
  hour: 20,
  minute: 0,
});

onMounted(() => {
  const cfg = getReminderConfig();
  reminderState.enabled = cfg.enabled;
  reminderState.hour = cfg.hour;
  reminderState.minute = cfg.minute;
});

async function handleReminderToggle(enabled: boolean) {
  if (enabled && isNotificationSupported.value) {
    await requestPermission();
  }
  reminderState.enabled = enabled;
  scheduleReminder(reminderState.hour, reminderState.minute, enabled);
}

function handleReminderTimeChange() {
  scheduleReminder(reminderState.hour, reminderState.minute, reminderState.enabled);
}

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
  } catch (e: unknown) {
    console.error(`保存失败: ${e}`);
  }
}

const INTERVAL_OPTIONS = [
  { label: '2 小时', value: 7200 },
  { label: '4 小时', value: 14400 },
  { label: '8 小时', value: 28800 },
  { label: '24 小时', value: 86400 },
];

const {
  currentMode,
  currentColor,
  currentCustomThemeId,
  isDark,
  applyTheme,
  getPresets,
  initFromStorage,
  listCustomThemes,
  exportTheme,
  deleteTheme,
  activateTheme,
  getPluginThemes,
  importTheme,
} = useMaterialYou();

const {
  fetchThemeManifest,
  importThemeFromSource,
  DEFAULT_THEME_SOURCE_URL,
} = useOnlineThemeSource();

const presets = getPresets();

const showEditor = ref(false);
const showImport = ref(false);
const showExport = ref(false);
const exportThemeId = ref('');
const customThemes = ref<CustomTheme[]>([]);
const pluginThemes = ref<CustomTheme[]>([]);
const onlineThemes = ref<ThemeEntry[]>([]);
const loadingOnline = ref(false);
const onlineError = ref('');

function refreshThemes() {
  customThemes.value = listCustomThemes();
  pluginThemes.value = getPluginThemes();
}

function handleActivate(id: string) {
  activateTheme(id);
  refreshThemes();
}

function handleExport(themeId: string) {
  exportThemeId.value = themeId;
  showExport.value = true;
}

function handleDelete(themeId: string) {
  deleteTheme(themeId);
  refreshThemes();
}

function isActive(themeId: string): boolean {
  return currentCustomThemeId.value === themeId;
}

function getThemeDots(theme: CustomTheme): string[] {
  return [
    theme.colors.primary || '#888',
    theme.colors.secondary || theme.colors.primary || '#888',
    theme.colors.surface || '#ccc',
    theme.colors.error || '#e11d48',
  ];
}

function getOnlineThemeDots(entry: ThemeEntry): string[] {
  return [
    entry.colors.primary || '#888',
    entry.colors.surface || '#ccc',
    entry.colors.error || '#e11d48',
  ];
}

function handleThemeSave(payload: { name: string; colors: Record<string, string> }) {
  importTheme(JSON.stringify({ name: payload.name, colors: payload.colors }));
  showEditor.value = false;
  refreshThemes();
}

async function loadOnlineThemes() {
  if (!DEFAULT_THEME_SOURCE_URL) return;
  loadingOnline.value = true;
  onlineError.value = '';
  try {
    const manifest = await fetchThemeManifest(DEFAULT_THEME_SOURCE_URL);
    onlineThemes.value = manifest.themes;
  } catch (e) {
    onlineError.value = e instanceof Error ? e.message : '加载在线主题失败';
  } finally {
    loadingOnline.value = false;
  }
}

async function handleImportOnlineTheme(entry: ThemeEntry) {
  try {
    importThemeFromSource(entry);
    refreshThemes();
  } catch (e) {
    onlineError.value = e instanceof Error ? e.message : '导入主题失败';
  }
}

onMounted(() => {
  initFromStorage();
  refreshThemes();
  loadOnlineThemes().catch(() => {});
});
</script>

<template>
  <SettingSection title="通用" section-id="section-general">
    <SettingItem label="主题" desc="选择应用外观主题；自动模式跟随系统">
      <n-radio-group
        :value="config.ui_theme"
        size="small"
        @update:value="(v: string) => handleSet('ui_theme', v)"
      >
        <n-radio-button value="auto">跟随系统</n-radio-button>
        <n-radio-button value="light">亮色</n-radio-button>
        <n-radio-button value="dark">暗色</n-radio-button>
      </n-radio-group>
    </SettingItem>

    <SettingItem label="界面密度" desc="调整全局间距和控件大小">
      <div style="display:flex;align-items:center;gap:6px">
        <n-radio-group
          :value="config.ui_density"
          size="small"
          @update:value="(v: string) => handleSet('ui_density', v)"
        >
          <n-radio-button v-for="opt in DENSITY_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </n-radio-button>
        </n-radio-group>
        <span class="density-hint">
          {{ DENSITY_OPTIONS.find(o => o.value === config.ui_density)?.desc ?? '' }}
        </span>
      </div>
    </SettingItem>

    <SettingItem label="字体大小" desc="调整界面文字大小">
      <n-radio-group
        :value="fontScale"
        size="small"
        @update:value="handleFontScaleChange"
      >
        <n-radio-button value="small">小</n-radio-button>
        <n-radio-button value="medium">中</n-radio-button>
        <n-radio-button value="large">大</n-radio-button>
      </n-radio-group>
    </SettingItem>
  </SettingSection>

  <SettingSection title="主题色" section-id="section-material-you">
    <SettingItem label="跟随系统" desc="使用系统默认主题色">
      <n-switch
        :value="currentMode === 'system'"
        @update:value="(v: boolean) => applyTheme(v ? 'system' : 'preset', currentColor)"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <template v-if="currentMode !== 'system'">
      <div v-if="customThemes.length > 0" class="theme-list-section">
        <div class="theme-section-title">我的主题</div>
        <div class="theme-list">
          <button
            v-for="theme in customThemes"
            :key="theme.id"
            class="theme-item"
            :class="{ 'theme-item--active': isActive(theme.id) }"
            @click="handleActivate(theme.id)"
          >
            <div class="theme-dots">
              <span
                v-for="(dot, di) in getThemeDots(theme)"
                :key="di"
                class="theme-dot"
                :style="{ backgroundColor: dot }"
              />
            </div>
            <span class="theme-name">{{ theme.name }}</span>
            <div class="theme-item-actions">
              <n-button size="tiny" quaternary @click.stop="handleExport(theme.id)">导出</n-button>
              <n-button size="tiny" quaternary type="error" @click.stop="handleDelete(theme.id)">删除</n-button>
            </div>
          </button>
        </div>
      </div>

      <div v-if="pluginThemes.length > 0" class="theme-list-section">
        <div class="theme-section-title">插件主题</div>
        <div class="theme-list">
          <button
            v-for="theme in pluginThemes"
            :key="theme.id"
            class="theme-item"
            :class="{ 'theme-item--active': isActive(theme.id) }"
            @click="handleActivate(theme.id)"
          >
            <div class="theme-dots">
              <span
                v-for="(dot, di) in getThemeDots(theme)"
                :key="di"
                class="theme-dot"
                :style="{ backgroundColor: dot }"
              />
            </div>
            <span class="theme-name">{{ theme.name }}</span>
          </button>
        </div>
      </div>

      <div class="theme-list-section">
        <div class="theme-section-title-row">
          <div class="theme-section-title">在线主题</div>
          <n-button size="tiny" quaternary @click="loadOnlineThemes">刷新</n-button>
        </div>
        <div v-if="loadingOnline" class="online-loading">
          <n-spin size="small" />
        </div>
        <div v-else-if="onlineError" class="online-error">
          <span class="online-error-text">{{ onlineError }}</span>
          <n-button size="tiny" quaternary @click="loadOnlineThemes">重试</n-button>
        </div>
        <div v-else-if="onlineThemes.length > 0" class="theme-list">
          <div
            v-for="theme in onlineThemes"
            :key="theme.id"
            class="theme-item"
          >
            <div class="theme-dots">
              <span
                v-for="(dot, di) in getOnlineThemeDots(theme)"
                :key="di"
                class="theme-dot"
                :style="{ backgroundColor: dot }"
              />
            </div>
            <div class="theme-info">
              <span class="theme-name">{{ theme.name }}</span>
              <span v-if="theme.description" class="theme-desc">{{ theme.description }}</span>
            </div>
            <div class="theme-item-actions">
              <n-button size="tiny" quaternary @click="handleImportOnlineTheme(theme)">导入</n-button>
            </div>
          </div>
        </div>
        <div v-else class="online-empty">暂无在线主题</div>
      </div>

      <div class="theme-list-section">
        <div class="theme-section-title">预设色板</div>
        <div class="preset-grid">
          <button
            v-for="preset in presets"
            :key="preset.name"
            class="preset-dot"
            :class="{ 'preset-dot--active': currentMode === 'preset' && currentColor === preset.color }"
            :style="{ backgroundColor: preset.color }"
            :title="preset.name"
            @click="applyTheme('preset', preset.color)"
          />
        </div>
      </div>

      <div class="theme-toolbar">
        <n-button size="small" @click="showEditor = true">+ 新建主题</n-button>
        <n-button size="small" @click="showImport = true">导入</n-button>
      </div>

      <div class="theme-list-section">
        <div class="theme-section-title">自定义颜色</div>
        <div class="preset-grid">
          <button
            class="preset-dot preset-dot--custom"
            :class="{ 'preset-dot--active': currentMode === 'custom' && !currentCustomThemeId }"
            title="自定义颜色"
          >
            <input
              type="color"
              :value="currentColor"
              class="preset-color-input"
              @input="(e: Event) => applyTheme('custom', (e.target as HTMLInputElement).value)"
            />
          </button>
        </div>
      </div>
    </template>
  </SettingSection>

  <SettingSection title="书架" section-id="section-bookshelf">
    <SettingItem label="自动更新目录" desc="定期在后台静默检测书籍是否有新章节，不影响阅读">
      <n-switch
        :value="tocCfg.enabled"
        @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ enabled: v })"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <template v-if="tocCfg.enabled">
      <SettingItem label="最小检测间隔" desc="两次自动检测同一本书之间的最短等待时间">
        <n-radio-group
          :value="tocCfg.minIntervalSecs"
          size="small"
          @update:value="(v: number) => prefsStore.patchTocAutoUpdate({ minIntervalSecs: v })"
        >
          <n-radio-button v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </n-radio-button>
        </n-radio-group>
      </SettingItem>

      <SettingItem
        label="打开图书时检测"
        desc="每次打开书籍时，若距离上次检测超过最小间隔则自动更新目录"
      >
        <n-switch
          :value="tocCfg.onBookOpen"
          @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ onBookOpen: v })"
        >
          <template #checked>开启</template>
          <template #unchecked>关闭</template>
        </n-switch>
      </SettingItem>

      <SettingItem label="启动 App 时检测" desc="每次启动应用时，后台逐本检测所有书籍的目录更新">
        <n-switch
          :value="tocCfg.onAppStart"
          @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ onAppStart: v })"
        >
          <template #checked>开启</template>
          <template #unchecked>关闭</template>
        </n-switch>
      </SettingItem>

      <SettingItem
        label="切换到书架时检测"
        desc="每次从其他页面切换回书架时，后台逐本检测所有书籍的目录更新"
      >
        <n-switch
          :value="tocCfg.onShelfView"
          @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ onShelfView: v })"
        >
          <template #checked>开启</template>
          <template #unchecked>关闭</template>
        </n-switch>
      </SettingItem>
    </template>
  </SettingSection>

  <SettingSection title="搜索与换源" section-id="section-search">
    <SettingItem
      label="搜索并发数"
      desc="同时向多少个书源发起搜索请求，越大速度越快但对网络压力越高，默认 5"
    >
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.searchConcurrency ?? 5"
          size="small"
          :min="1"
          :max="20"
          style="width: 80px"
          @update:value="
            (v: number | null) => prefsStore.patchSearch({ searchConcurrency: Math.max(1, v ?? 5) })
          "
        />
        <span>个</span>
      </div>
    </SettingItem>

    <SettingItem label="换源并发数" desc="换源搜索时同时查询的书源数量，默认 5">
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.switchSourceConcurrency ?? 5"
          size="small"
          :min="1"
          :max="20"
          style="width: 80px"
          @update:value="
            (v: number | null) =>
              prefsStore.patchSearch({
                switchSourceConcurrency: Math.max(1, v ?? 5),
              })
          "
        />
        <span>个</span>
      </div>
    </SettingItem>
  </SettingSection>

  <SettingSection title="阅读提醒" section-id="section-reminder">
    <SettingItem
      label="每日阅读提醒"
      desc="在设定时间发送通知提醒您阅读"
    >
      <n-switch
        :value="reminderState.enabled"
        @update:value="handleReminderToggle"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <template v-if="reminderState.enabled">
      <SettingItem label="提醒时间" desc="设置每日阅读提醒的时间">
        <div style="display: flex; gap: 8px; align-items: center">
          <n-input-number
            :value="reminderState.hour"
            size="small"
            :min="0"
            :max="23"
            style="width: 72px"
            @update:value="
              (v: number | null) => {
                reminderState.hour = Math.max(0, Math.min(23, v ?? 20));
                handleReminderTimeChange();
              }
            "
          />
          <span>时</span>
          <n-input-number
            :value="reminderState.minute"
            size="small"
            :min="0"
            :max="59"
            style="width: 72px"
            @update:value="
              (v: number | null) => {
                reminderState.minute = Math.max(0, Math.min(59, v ?? 0));
                handleReminderTimeChange();
              }
            "
          />
          <span>分</span>
        </div>
      </SettingItem>
    </template>
  </SettingSection>

  <ThemeEditor v-if="showEditor" :show="showEditor" @update:show="showEditor = $event" @save="handleThemeSave" />
  <ThemeImportDialog v-if="showImport" @close="showImport = false; refreshThemes()" />
  <ThemeExportDialog
    v-if="showExport"
    :theme-id="exportThemeId"
    @close="showExport = false"
  />
</template>

<style scoped>
.theme-list-section {
  padding: 8px 16px;
}

.theme-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #666);
  margin-bottom: 8px;
}

.theme-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  width: 100%;
  text-align: left;
  font-size: 14px;
  color: var(--color-text, #333);
}

.theme-item:hover {
  background: rgba(128, 128, 128, 0.08);
}

.theme-item--active {
  border-color: var(--color-accent, #4467FF);
  background: rgba(68, 103, 255, 0.06);
}

.theme-dots {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.theme-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.theme-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.theme-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
}

.preset-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  padding: 0 16px;
}

.preset-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  padding: 0;
  outline: none;
}

.preset-dot:hover {
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.1);
}

.preset-dot--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(68, 103, 255, 0.35);
}

.preset-dot--custom {
  background: conic-gradient(
    #ff0000,
    #ffff00,
    #00ff00,
    #00ffff,
    #0000ff,
    #ff00ff,
    #ff0000
  );
  position: relative;
  overflow: hidden;
}

.preset-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.density-hint {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  margin-left: 8px;
}

.theme-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.theme-section-title-row .theme-section-title {
  margin-bottom: 0;
}

.online-loading {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.online-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.online-error-text {
  font-size: 13px;
  color: var(--color-error, #e11d48);
  flex: 1;
}

.theme-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.theme-desc {
  font-size: 12px;
  color: var(--color-text-muted, #999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.online-empty {
  font-size: 13px;
  color: var(--color-text-muted, #999);
  padding: 8px 0;
}
</style>
