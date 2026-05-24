<template>
  <n-drawer v-model:show="showPanel" :width="340" placement="right">
    <n-drawer-content :title="`标注 · 笔记 (${totalCount})`" :native-scrollbar="false">
      <template v-if="totalCount === 0">
        <div class="annotations-empty">
          <p>暂无标注</p>
          <p class="annotations-empty-hint">在阅读时长按选择文本即可添加划线标注</p>
        </div>
      </template>

      <div v-else class="annotations-list">
        <div
          v-for="item in annotationItems"
          :key="item.id"
          class="annotation-item"
          :style="{ borderLeftColor: item.color }"
          @click="onItemClick(item)"
        >
          <div class="annotation-item-header">
            <span class="annotation-color-dot" :style="{ backgroundColor: item.color }" />
            <span class="annotation-chapter">{{ item.chapterLabel }}</span>
            <n-button text size="tiny" type="error" @click.stop="onDelete(item.id)">
              删除
            </n-button>
          </div>
          <blockquote class="annotation-text">{{ item.text }}</blockquote>
          <p v-if="item.note" class="annotation-note">{{ item.note }}</p>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NDrawer, NDrawerContent, NButton } from "naive-ui";
import { useAnnotationsStore } from "@/stores/annotations";
import type { Annotation } from "@/stores/annotations";

interface AnnotationItem {
  id: string;
  text: string;
  color: string;
  note: string;
  chapterLabel: string;
  chapterIndex: number;
  startOffset: number;
}

const props = defineProps<{
  visible: boolean;
  bookId: string;
  chapterNames?: string[];
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "close"): void;
  (e: "navigate", data: { chapterIndex: number; offset: number }): void;
  (e: "delete", id: string): void;
}>();

const showPanel = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

const annotationsStore = useAnnotationsStore();

const totalCount = computed(() =>
  annotationsStore.getBookAnnotations(props.bookId).length,
);

const annotationItems = computed<AnnotationItem[]>(() => {
  const chapterNames = props.chapterNames ?? [];
  return annotationsStore
    .getBookAnnotations(props.bookId)
    .map((a) => ({
      id: a.id,
      text: a.text.length > 80 ? a.text.slice(0, 80) + "..." : a.text,
      color: a.color,
      note: a.note,
      chapterLabel: chapterNames[a.chapterIndex] ?? `第${a.chapterIndex + 1}章`,
      chapterIndex: a.chapterIndex,
      startOffset: a.startOffset,
    }))
    .sort((a, b) => {
      if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex - b.chapterIndex;
      return a.startOffset - b.startOffset;
    });
});

function onItemClick(item: AnnotationItem) {
  emit("navigate", {
    chapterIndex: item.chapterIndex,
    offset: item.startOffset,
  });
}

function onDelete(id: string) {
  annotationsStore.removeAnnotation(id);
  emit("delete", id);
}
</script>

<style scoped>
.annotations-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--n-text-color-3);
}

.annotations-empty-hint {
  font-size: 13px;
  margin-top: 8px;
}

.annotations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annotation-item {
  padding: 12px;
  border-left: 3px solid var(--annotation-color);
  border-radius: 4px;
  background: var(--n-color-embedded);
  cursor: pointer;
  transition: background 0.15s;
}

.annotation-item:hover {
  background: var(--n-color-embedded-hover);
}

.annotation-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.annotation-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.annotation-chapter {
  flex: 1;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.annotation-text {
  margin: 0 0 4px 0;
  font-size: 14px;
  line-height: 1.6;
  padding: 0;
  border: none;
  color: var(--n-text-color);
}

.annotation-note {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: var(--n-text-color-2);
  line-height: 1.5;
  padding: 6px 8px;
  background: var(--n-color-embedded);
  border-radius: 4px;
}
</style>