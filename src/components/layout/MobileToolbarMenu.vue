<script setup lang="ts">
import type { DropdownOption } from 'naive-ui';
/**
 * MobileToolbarMenu — 移动端工具栏三点菜单
 *
 * 收起为竖三点下拉菜单（AppSheet + AppListItem）
 *
 * 用法：
 *   <MobileToolbarMenu :options="menuOptions" @select="handleSelect">
 *     <!-- 桌面端工具栏按钮 -->
 *     <n-button .../>
 *   </MobileToolbarMenu>
 */
import { MoreVertical } from 'lucide-vue-next';
import { ref } from 'vue';
import AppListItem from '../base/AppListItem.vue';
import AppSheet from '../base/AppSheet.vue';

export type MenuOption = DropdownOption;

defineProps<{
  options: MenuOption[];
}>();

const emit = defineEmits<{
  (e: 'select', key: string): void;
}>();

const sheetOpen = ref(false);

function onSelect(key: string) {
  sheetOpen.value = false;
  emit('select', key);
}
</script>

<template>
  <n-button size="small" quaternary aria-label="更多操作" @click="sheetOpen = true">
    <template #icon>
      <MoreVertical :size="16" />
    </template>
  </n-button>
  <AppSheet v-model="sheetOpen">
    <div class="mtm-sheet" role="menu">
      <AppListItem
        v-for="opt in options"
        :key="String(opt.key)"
        :title="String(opt.label ?? opt.key)"
        :disabled="!!opt.disabled"
        role="menuitem"
        @click="onSelect(String(opt.key))"
      />
    </div>
  </AppSheet>
</template>

<style scoped>
.mtm-sheet {
  padding: var(--space-2) var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  overflow-y: auto;
}
</style>
