import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useResponsiveControl } from "./useResponsiveControl";

export function useLandscapeDualPage() {
  const { breakpoint, isLandscape } = useResponsiveControl();

  const windowSizeClass = ref(
    typeof window !== "undefined"
      ? window.innerWidth >= 840
        ? "expanded"
        : window.innerWidth >= 600
          ? "medium"
          : "compact"
      : "compact",
  );

  let _mq600: MediaQueryList | null = null;
  let _mq840: MediaQueryList | null = null;

  function _updateWindowSizeClass() {
    windowSizeClass.value =
      window.innerWidth >= 840 ? "expanded" : window.innerWidth >= 600 ? "medium" : "compact";
  }

  onMounted(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      _mq600 = window.matchMedia("(min-width: 600px)");
      _mq840 = window.matchMedia("(min-width: 840px)");
      _mq600.addEventListener("change", _updateWindowSizeClass);
      _mq840.addEventListener("change", _updateWindowSizeClass);
    }
  });

  onUnmounted(() => {
    _mq600?.removeEventListener("change", _updateWindowSizeClass);
    _mq840?.removeEventListener("change", _updateWindowSizeClass);
  });

  const isDualPage = computed(() => isLandscape.value && breakpoint.value !== "compact");

  const dualPageStyle = computed(() => {
    if (!isDualPage.value) {
      return {};
    }
    return {
      columnCount: 2,
      columnGap: "40px",
      columnRule: "1px solid var(--color-border)",
    };
  });

  const columnContainerClass = computed(() => (isDualPage.value ? "dual-page-container" : ""));

  return {
    isDualPage,
    dualPageStyle,
    columnContainerClass,
    isLandscape,
    breakpoint,
  };
}
