import { computed, onMounted, onUnmounted, ref } from "vue";

export type WindowSizeClass = "compact" | "medium" | "expanded";

const width = ref(typeof window === "undefined" ? 0 : window.innerWidth);
const height = ref(typeof window === "undefined" ? 0 : window.innerHeight);

let previousRatio: number | null = null;

function getWindowSizeClass(value: number): WindowSizeClass {
  if (value >= 840) return "expanded";
  if (value >= 600) return "medium";
  return "compact";
}

function getColumns(sizeClass: WindowSizeClass): number {
  switch (sizeClass) {
    case "expanded":
      return 6;
    case "medium":
      return 4;
    case "compact":
    default:
      return 3;
  }
}

export function useWindowSizeClass() {
  function update() {
    width.value = window.innerWidth;
    height.value = window.innerHeight;
  }

  onMounted(() => {
    update();
    window.matchMedia("(min-width: 600px)").addEventListener("change", update);
    window.matchMedia("(min-width: 840px)").addEventListener("change", update);
    window.addEventListener("resize", update, { passive: true });
  });

  onUnmounted(() => {
    window.matchMedia("(min-width: 600px)").removeEventListener("change", update);
    window.matchMedia("(min-width: 840px)").removeEventListener("change", update);
    window.removeEventListener("resize", update);
  });

  const windowSizeClass = computed<WindowSizeClass>(() => getWindowSizeClass(width.value));

  const columns = computed<number>(() => getColumns(windowSizeClass.value));

  const isFoldable = computed<boolean>(() => {
    if (width.value === 0 || height.value === 0) return false;
    const ratio = width.value / height.value;
    if (previousRatio === null) {
      previousRatio = ratio;
      return false;
    }
    const isWide = ratio > 1.2;
    const wasWide = previousRatio > 1.2;
    const changed = isWide !== wasWide;
    previousRatio = ratio;
    return changed;
  });

  return {
    windowSizeClass,
    columns,
    isFoldable,
  };
}
