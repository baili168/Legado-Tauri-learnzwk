<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useReaderActionsStore } from '@/features/reader/stores/readerActions';

export interface KeyboardHandlerOptions {
  enabled?: boolean;
  onOpenSearch?: () => void;
  onToggleBookmark?: () => void;
  onAddHighlight?: () => void;
}

const props = withDefaults(defineProps<KeyboardHandlerOptions>(), {
  enabled: true,
});

const emit = defineEmits<{
  (e: 'escape'): void;
}>();

const readerActions = useReaderActionsStore();

function handleKeyDown(event: KeyboardEvent) {
  if (!props.enabled) return;

  const target = event.target as HTMLElement;
  const isInputLike =
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable;

  if (isInputLike) return;

  const isCtrlOrCmd = event.ctrlKey || event.metaKey;

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      readerActions.gotoPrevBoundary();
      break;

    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      readerActions.gotoNextBoundary();
      break;

    case 'PageUp':
      event.preventDefault();
      readerActions.gotoPrevBoundary();
      break;

    case 'PageDown':
      event.preventDefault();
      readerActions.gotoNextBoundary();
      break;

    case 'Home':
      event.preventDefault();
      readerActions.gotoPrevBoundary();
      break;

    case 'End':
      event.preventDefault();
      readerActions.gotoNextBoundary();
      break;

    case ' ':
      event.preventDefault();
      readerActions.gotoNextBoundary();
      break;

    case 'Enter':
      event.preventDefault();
      readerActions.gotoNextBoundary();
      break;

    case 'Escape':
      event.preventDefault();
      emit('escape');
      readerActions.close();
      break;

    case 'f':
    case 'F':
      if (isCtrlOrCmd) {
        event.preventDefault();
        props.onOpenSearch?.();
      }
      break;

    case 'b':
    case 'B':
      if (isCtrlOrCmd) {
        event.preventDefault();
        props.onAddHighlight?.();
      } else {
        event.preventDefault();
        props.onToggleBookmark?.();
      }
      break;

    default:
      break;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, { capture: true });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, { capture: true });
});
</script>

<script lang="ts">
export function useReaderKeyboard(options?: KeyboardHandlerOptions) {
  return {
    onKeyDown: handleKeyDown,
    options,
  };
}
</script>

<template>
  <slot />
</template>
