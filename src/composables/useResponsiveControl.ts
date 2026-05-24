import { computed, onMounted, onUnmounted, ref } from "vue";

export type ResponsiveBreakpoint = "compact" | "medium" | "expanded" | "wide";
export type DensityScale = 0.875 | 1 | 1.125;
export type DensityMode = "compact" | "standard" | "comfortable";

const DENSITY_SCALE_MAP: Record<DensityMode, DensityScale> = {
  compact: 0.875,
  standard: 1,
  comfortable: 1.125,
};

export interface DialogSizeConfig {
  width: string;
  height: string;
  maxWidth: string;
}

const width = ref(typeof window === "undefined" ? 0 : window.innerWidth);

function getBreakpoint(value: number): ResponsiveBreakpoint {
  if (value > 1200) return "wide";
  if (value > 840) return "expanded";
  if (value > 600) return "medium";
  return "compact";
}

const DIALOG_SIZE_MAP: Record<ResponsiveBreakpoint, DialogSizeConfig> = {
  compact: { width: "100vw", height: "92vh", maxWidth: "none" },
  medium: { width: "480px", height: "85vh", maxWidth: "90vw" },
  expanded: { width: "600px", height: "80vh", maxWidth: "640px" },
  wide: { width: "720px", height: "75vh", maxWidth: "760px" },
};

let _mql600: MediaQueryList | null = null;
let _mql840: MediaQueryList | null = null;
let _mql1200: MediaQueryList | null = null;
let _mqlLandscape: MediaQueryList | null = null;

export function useResponsiveControl() {
  function update() {
    width.value = window.innerWidth;
  }

  const isLandscape = ref(
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(orientation: landscape)").matches
      : false,
  );

  function _onLandscapeChange(e: MediaQueryListEvent) {
    isLandscape.value = e.matches;
  }

  onMounted(() => {
    update();
    if (typeof window !== "undefined" && window.matchMedia) {
      _mql600 = window.matchMedia("(min-width: 600px)");
      _mql840 = window.matchMedia("(min-width: 840px)");
      _mql1200 = window.matchMedia("(min-width: 1200px)");
      _mqlLandscape = window.matchMedia("(orientation: landscape)");
      _mql600.addEventListener("change", update);
      _mql840.addEventListener("change", update);
      _mql1200.addEventListener("change", update);
      _mqlLandscape.addEventListener("change", _onLandscapeChange);
    }
    window.addEventListener("resize", update, { passive: true });
  });

  onUnmounted(() => {
    _mql600?.removeEventListener("change", update);
    _mql840?.removeEventListener("change", update);
    _mql1200?.removeEventListener("change", update);
    _mqlLandscape?.removeEventListener("change", _onLandscapeChange);
    window.removeEventListener("resize", update);
  });

  const breakpoint = computed<ResponsiveBreakpoint>(() => getBreakpoint(width.value));

  const densityMode = computed<DensityMode>(() => {
    if (typeof window === "undefined") return "standard";
    const stored = localStorage.getItem("legado-ui-density");
    if (stored === "compact" || stored === "standard" || stored === "comfortable") {
      return stored;
    }
    return "standard";
  });

  const densityScale = computed<DensityScale>(() => DENSITY_SCALE_MAP[densityMode.value]);

  const dialogSize = computed<DialogSizeConfig>(() => DIALOG_SIZE_MAP[breakpoint.value]);

  const fontScale = computed<number>(() => {
    if (typeof document === "undefined") return 1;
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--ui-font-scale")
      .trim();
    const num = parseFloat(value);
    return Number.isFinite(num) && num > 0 ? num : 1;
  });

  const columns = computed<number>(() => {
    switch (breakpoint.value) {
      case "wide":
        return 6;
      case "expanded":
        return 5;
      case "medium":
        return 4;
      case "compact":
      default:
        return 3;
    }
  });

  return {
    width,
    breakpoint,
    densityMode,
    densityScale,
    dialogSize,
    fontScale,
    isLandscape,
    columns,
  };
}
