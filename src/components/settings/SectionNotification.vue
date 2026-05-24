<script setup lang="ts">
import { reactive, onMounted } from "vue";
import { useNotification } from "@/composables/useNotification";
import { useChapterUpdateChecker } from "@/composables/useChapterUpdateChecker";
import SettingSection from "./SettingSection.vue";
import SettingItem from "./SettingItem.vue";

const STORAGE_KEY = "legado-notification-settings";

interface NotificationSettings {
  autoCheckEnabled: boolean;
  checkIntervalMin: number;
  pushNotificationEnabled: boolean;
}

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as NotificationSettings;
    }
  } catch {
    // ignore
  }
  return {
    autoCheckEnabled: false,
    checkIntervalMin: 60,
    pushNotificationEnabled: false,
  };
}

function saveSettings(s: NotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const settings = reactive<NotificationSettings>(loadSettings());

const { isNotificationSupported, permissionGranted, requestPermission } = useNotification();
const { checkAllUpdates, isCheckingAll } = useChapterUpdateChecker();

const INTERVAL_OPTIONS = [
  { label: "30 分钟", value: 30 },
  { label: "1 小时", value: 60 },
  { label: "2 小时", value: 120 },
];

let intervalTimer: ReturnType<typeof setInterval> | null = null;

function applyAutoCheck() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  if (settings.autoCheckEnabled) {
    const ms = settings.checkIntervalMin * 60 * 1000;
    intervalTimer = setInterval(() => {
      checkAllUpdates().catch(() => {});
    }, ms);
  }
}

onMounted(() => {
  applyAutoCheck();
});

function handleAutoCheckToggle(v: boolean) {
  settings.autoCheckEnabled = v;
  saveSettings({ ...settings });
  applyAutoCheck();
}

function handleIntervalChange(v: number) {
  settings.checkIntervalMin = v;
  saveSettings({ ...settings });
  applyAutoCheck();
}

async function handlePushNotificationToggle(v: boolean) {
  if (v && isNotificationSupported.value && !permissionGranted.value) {
    const granted = await requestPermission();
    if (!granted) {
      return;
    }
  }
  settings.pushNotificationEnabled = v;
  saveSettings({ ...settings });
}

function handleManualCheck() {
  checkAllUpdates().catch(() => {});
}
</script>

<template>
  <SettingSection title="更新通知" section-id="section-notification">
    <SettingItem label="自动检查更新" desc="按设定间隔自动检测书籍章节更新">
      <n-switch
        :value="settings.autoCheckEnabled"
        @update:value="handleAutoCheckToggle"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <template v-if="settings.autoCheckEnabled">
      <SettingItem label="检查间隔" desc="自动检查更新的间隔时间">
        <n-radio-group
          :value="settings.checkIntervalMin"
          size="small"
          @update:value="handleIntervalChange"
        >
          <n-radio-button v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </n-radio-button>
        </n-radio-group>
      </SettingItem>
    </template>

    <SettingItem
      v-if="isNotificationSupported"
      label="推送系统通知"
      desc="发现新章节时通过系统通知提醒"
    >
      <n-switch
        :value="settings.pushNotificationEnabled"
        @update:value="handlePushNotificationToggle"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <SettingItem label="手动检查更新" desc="立即检查书架中所有书籍是否有新章节">
      <n-button
        size="small"
        :loading="isCheckingAll"
        @click="handleManualCheck"
      >
        <template #icon>
          <span style="font-size: 1rem">&#x21bb;</span>
        </template>
        立即检查
      </n-button>
    </SettingItem>
  </SettingSection>
</template>