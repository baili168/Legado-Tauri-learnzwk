<script setup lang="ts">
import { useDialog } from "naive-ui";
import { CheckSquare, Square, Tag, FolderOpen, Eye, EyeOff, Trash2, X } from "lucide-vue-next";

const props = defineProps<{
  selectedCount: number;
  allSelected: boolean;
}>();

const emit = defineEmits<{
  (e: "select-all"): void;
  (e: "add-tags"): void;
  (e: "move-group"): void;
  (e: "mark-read"): void;
  (e: "mark-unread"): void;
  (e: "delete"): void;
  (e: "cancel"): void;
}>();

const dialog = useDialog();

function handleDelete() {
  dialog.warning({
    title: "确认删除",
    content: `确定要删除选中的 ${props.selectedCount} 本书吗？此操作不可恢复。`,
    positiveText: "确认删除",
    negativeText: "取消",
    onPositiveClick: () => {
      emit("delete");
    },
  });
}
</script>

<template>
  <Transition name="ba-slide">
    <div v-if="selectedCount > 0" class="batch-action-bar">
      <span class="ba-count">已选 {{ selectedCount }} 本</span>
      <div class="ba-actions">
        <button class="ba-btn" @click="emit('select-all')">
          <component :is="allSelected ? CheckSquare : Square" :size="16" />
          <span>{{ allSelected ? "取消全选" : "全选" }}</span>
        </button>
        <button class="ba-btn" @click="emit('add-tags')">
          <Tag :size="16" />
          <span>加标签</span>
        </button>
        <button class="ba-btn" @click="emit('move-group')">
          <FolderOpen :size="16" />
          <span>移动分组</span>
        </button>
        <button class="ba-btn" @click="emit('mark-read')">
          <Eye :size="16" />
          <span>标记已读</span>
        </button>
        <button class="ba-btn" @click="emit('mark-unread')">
          <EyeOff :size="16" />
          <span>标记未读</span>
        </button>
        <button class="ba-btn ba-btn--danger" @click="handleDelete">
          <Trash2 :size="16" />
          <span>删除</span>
        </button>
        <button class="ba-btn ba-btn--cancel" @click="emit('cancel')">
          <X :size="16" />
          <span>取消</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.batch-action-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.ba-count {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--color-accent);
  white-space: nowrap;
  flex-shrink: 0;
}

.ba-actions {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  flex-shrink: 0;
}

.ba-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: var(--radius-1);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  font-size: var(--fs-12);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard);
}

.ba-btn:hover {
  background: var(--color-fill-secondary);
  border-color: var(--color-border-strong);
}

.ba-btn:active {
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
}

.ba-btn--danger {
  color: var(--red-500);
  border-color: color-mix(in srgb, var(--red-500) 35%, var(--color-border));
}

.ba-btn--danger:hover {
  background: color-mix(in srgb, var(--red-500) 10%, var(--color-surface));
  border-color: var(--red-500);
}

.ba-btn--cancel {
  color: var(--color-text-muted);
}

.ba-slide-enter-active,
.ba-slide-leave-active {
  transition:
    transform 0.22s var(--ease-standard),
    opacity 0.22s;
}

.ba-slide-enter-from,
.ba-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>