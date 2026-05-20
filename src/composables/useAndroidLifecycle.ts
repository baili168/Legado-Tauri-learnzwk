import { onUnmounted, ref, type Ref } from 'vue';
import { eventListenSync } from './useEventBus';

type LifecycleCallback = () => void | Promise<void>;

const pauseCallbacks = new Set<LifecycleCallback>();
const resumeCallbacks = new Set<LifecycleCallback>();
const stopCallbacks = new Set<LifecycleCallback>();
const destroyCallbacks = new Set<LifecycleCallback>();

const isForeground: Ref<boolean> = ref(typeof document !== 'undefined' && document.visibilityState === 'visible');

let visibilityUnlisten: (() => void) | null = null;
let beforeunloadBound = false;
let lifecycleUnlisten: (() => void) | null = null;
let initialized = false;

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    isForeground.value = true;
    resumeCallbacks.forEach((fn) => fn());
  } else if (document.visibilityState === 'hidden') {
    isForeground.value = false;
    pauseCallbacks.forEach((fn) => fn());
  }
}

function handleBeforeUnload() {
  stopCallbacks.forEach((fn) => fn());
  destroyCallbacks.forEach((fn) => fn());
}

function handleLifecycleEvent(event: unknown) {
  const payload = event as { state?: string } | undefined;
  if (!payload?.state) return;

  switch (payload.state) {
    case 'resume':
      isForeground.value = true;
      resumeCallbacks.forEach((fn) => fn());
      break;
    case 'pause':
      isForeground.value = false;
      pauseCallbacks.forEach((fn) => fn());
      break;
    case 'stop':
      stopCallbacks.forEach((fn) => fn());
      break;
    case 'destroy':
      destroyCallbacks.forEach((fn) => fn());
      break;
  }
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityUnlisten = () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
    beforeunloadBound = true;
  }

  lifecycleUnlisten = eventListenSync('legado:lifecycle', handleLifecycleEvent);
}

export function useAndroidLifecycle() {
  ensureInitialized();

  function onPause(fn: LifecycleCallback) {
    pauseCallbacks.add(fn);
    onUnmounted(() => pauseCallbacks.delete(fn));
  }

  function onResume(fn: LifecycleCallback) {
    resumeCallbacks.add(fn);
    onUnmounted(() => resumeCallbacks.delete(fn));
  }

  function onStop(fn: LifecycleCallback) {
    stopCallbacks.add(fn);
    onUnmounted(() => stopCallbacks.delete(fn));
  }

  function onDestroy(fn: LifecycleCallback) {
    destroyCallbacks.add(fn);
    onUnmounted(() => destroyCallbacks.delete(fn));
  }

  return {
    isForeground,
    onPause,
    onResume,
    onStop,
    onDestroy,
  };
}