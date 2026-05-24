<script setup lang="ts">
import type { Component } from "vue";
import { BookOpen, Compass, Search, LayoutGrid, Package, SlidersHorizontal, Bell, BarChart3 } from "lucide-vue-next";
import type { NavItem } from "@/types";

const props = withDefaults(
  defineProps<{
    items?: NavItem[];
    activeId?: string;
    unreadCount?: number;
  }>(),
  {
    items: () => [],
    activeId: "",
    unreadCount: 0,
  },
);

const emit = defineEmits<{
  select: [id: string];
  notification: [];
}>();

function onKeyDown(event: KeyboardEvent, index: number) {
  const len = props.items.length;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    const next = (index + 1) % len;
    (document.querySelectorAll(".bottom-nav__item")[next] as HTMLElement)?.focus();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    const prev = (index - 1 + len) % len;
    (document.querySelectorAll(".bottom-nav__item")[prev] as HTMLElement)?.focus();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("select", props.items[index].id);
  }
}

/**
 * 内置导航图标映射（使用 lucide-vue-next 组件）
 */
const ICON_COMPONENTS: Record<string, Component> = {
  bookshelf: BookOpen,
  explore: Compass,
  search: Search,
  booksource: LayoutGrid,
  extensions: Package,
  settings: SlidersHorizontal,
};
</script>

<template>
  <nav class="bottom-nav" role="tablist" :aria-label="'主导航'">
    <button
      v-for="(item, index) in items"
      :key="item.id"
      class="bottom-nav__item focusable"
      :class="{ 'bottom-nav__item--active': activeId === item.id }"
      :aria-label="item.label"
      :aria-selected="activeId === item.id"
      role="tab"
      tabindex="0"
      @click="emit('select', item.id)"
      @keydown="onKeyDown($event, index)"
    >
      <span class="bottom-nav__icon" aria-hidden="true">
        <component :is="ICON_COMPONENTS[item.icon]" :size="22" :stroke-width="1.75" />
      </span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </button>
    <button
      class="bottom-nav__item bottom-nav__item--notif focusable"
      :class="{ 'bottom-nav__item--active': activeId === 'updateFeed' }"
      aria-label="更新通知"
      role="tab"
      tabindex="0"
      @click="emit('notification')"
    >
      <span class="bottom-nav__icon" aria-hidden="true">
        <Bell :size="22" :stroke-width="1.75" />
        <span v-if="unreadCount > 0" class="bottom-nav__badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </span>
      <span class="bottom-nav__label">更新</span>
    </button>
    <button
      class="bottom-nav__item bottom-nav__item--extra focusable"
      :class="{ 'bottom-nav__item--active': activeId === 'readingHistory' }"
      aria-label="阅读记录"
      role="tab"
      tabindex="0"
      @click="emit('select', 'readingHistory')"
    >
      <span class="bottom-nav__icon" aria-hidden="true">
        <BarChart3 :size="22" :stroke-width="1.75" />
      </span>
      <span class="bottom-nav__label">记录</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  grid-area: bottomnav;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  min-height: calc(var(--bottom-bar-height) + var(--safe-bottom));
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  user-select: none;
  padding: 0 var(--space-1);
  padding-bottom: var(--safe-bottom);
}

.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-standard);
  padding: var(--space-1) 0;
  min-height: var(--tap-target);
  min-width: 0;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav__item:active {
  opacity: 0.7;
}

.bottom-nav__item--active {
  color: var(--color-accent);
}

.bottom-nav__icon {
  flex-shrink: 0;
  width: 1.375rem;
  height: 1.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav__label {
  font-size: var(--fs-11);
  font-weight: var(--fw-medium);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: var(--lh-tight);
}

.bottom-nav__badge {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--color-error);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  white-space: nowrap;
}
</style>
