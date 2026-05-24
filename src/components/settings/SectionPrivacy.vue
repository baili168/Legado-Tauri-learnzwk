<script setup lang="ts">
import { useMessage } from "naive-ui";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { usePrivacyModeStore } from "@/stores/privacyMode";
import SettingItem from "./SettingItem.vue";
import SettingSection from "./SettingSection.vue";

const message = useMessage();
const privacyStore = usePrivacyModeStore();
const { defaultIncognito, skippedBooks } = storeToRefs(privacyStore);

const skippedCount = computed(() => skippedBooks.value.size);

function handleClearSkippedBooks() {
  privacyStore.clearSkippedBooks();
  message.success("已清除隐身阅读记录");
}
</script>

<template>
  <SettingSection title="隐私与安全" section-id="section-privacy">
    <SettingItem
      label="隐身模式默认开关"
      desc="开启后，每次打开书籍将默认进入隐身模式，阅读进度不会被保存，也不会记录到阅读历史中"
    >
      <n-switch
        :value="defaultIncognito"
        @update:value="(v: boolean) => privacyStore.setDefaultIncognito(v)"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <SettingItem
      label="清除隐身阅读记录"
      :desc="`清除所有在隐身模式下阅读过的书籍记录（${skippedCount} 条记录）`"
    >
      <n-button
        size="small"
        quaternary
        :disabled="skippedCount === 0"
        @click="handleClearSkippedBooks"
      >
        清除记录
      </n-button>
    </SettingItem>
  </SettingSection>
</template>