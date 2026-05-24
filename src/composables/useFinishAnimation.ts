import { ref } from "vue";

const overlayVisible = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function useFinishAnimation() {
  function showFinishCelebration() {
    overlayVisible.value = true;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      overlayVisible.value = false;
      hideTimer = null;
    }, 2000);
  }

  function hideFinishCelebration() {
    overlayVisible.value = false;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  return {
    overlayVisible,
    showFinishCelebration,
    hideFinishCelebration,
  };
}