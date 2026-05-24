import { ref, computed } from "vue";
import type { ReaderTheme } from "@/components/reader/types";
import { useReaderSettingsStore } from "@/stores";
import { copyText } from "@/utils/clipboard";

export interface ThemeItem {
  id: string;
  name: string;
  author: string;
  description: string;
  categories: string[];
  previewColors: string[];
  downloadCount: number;
  rating: number;
  themeData: ReaderTheme;
}

export type ThemeCategory = "全部" | "暗色" | "亮色" | "护眼" | "漫画";

const IMPORTED_THEMES_KEY = "legado-market-imported-themes";

function getImportedThemeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(IMPORTED_THEMES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markThemeImported(themeId: string) {
  const ids = getImportedThemeIds();
  ids.add(themeId);
  try {
    localStorage.setItem(IMPORTED_THEMES_KEY, JSON.stringify([...ids]));
  } catch {}
}

function isThemeImported(themeId: string): boolean {
  return getImportedThemeIds().has(themeId);
}

const CURATED_THEMES: ThemeItem[] = [
  {
    id: "market-ink-wash",
    name: "水墨丹青",
    author: "Legado 官方",
    description: "仿宣纸质感，墨色文字，适合长时间沉浸阅读古典文学",
    categories: ["亮色", "护眼"],
    previewColors: ["#f5f0e8", "#3d3226", "#8b7355", "#c4b998", "#a08060"],
    downloadCount: 12580,
    rating: 4.8,
    themeData: {
      name: "水墨丹青",
      backgroundColor: "#f5f0e8",
      textColor: "#3d3226",
      selectionColor: "#c4b998",
    },
  },
  {
    id: "market-midnight-ocean",
    name: "深海午夜",
    author: "夜色工坊",
    description: "深海般深邃的暗色背景，柔和青色文字，夜间阅读不刺眼",
    categories: ["暗色"],
    previewColors: ["#0d1b2a", "#778da9", "#1b2838", "#415a77", "#e0e1dd"],
    downloadCount: 9820,
    rating: 4.7,
    themeData: {
      name: "深海午夜",
      backgroundColor: "#0d1b2a",
      textColor: "#e0e1dd",
      selectionColor: "#415a77",
    },
  },
  {
    id: "market-amber-dusk",
    name: "琥珀黄昏",
    author: "暖光集",
    description: "温暖琥珀底色配深棕文字，仿佛黄昏时分的阳光洒在书页上",
    categories: ["亮色", "护眼"],
    previewColors: ["#fdf0d5", "#5c3d2e", "#e8c07a", "#b88a5c", "#3d1f0a"],
    downloadCount: 7650,
    rating: 4.6,
    themeData: {
      name: "琥珀黄昏",
      backgroundColor: "#fdf0d5",
      textColor: "#5c3d2e",
      selectionColor: "#e8c07a",
    },
  },
  {
    id: "market-sakura-dream",
    name: "樱梦轻语",
    author: "花见坂",
    description: "淡樱粉色背景，柔和深红文字，少女心爆棚的阅读体验",
    categories: ["亮色"],
    previewColors: ["#fff0f3", "#8b3a62", "#f2c4d0", "#d4687c", "#4a1525"],
    downloadCount: 5430,
    rating: 4.5,
    themeData: {
      name: "樱梦轻语",
      backgroundColor: "#fff0f3",
      textColor: "#8b3a62",
      selectionColor: "#f2c4d0",
    },
  },
  {
    id: "market-manga-white",
    name: "漫画纯白",
    author: "二次元工坊",
    description: "高对比度纯白背景配纯黑文字，完美还原纸质漫画的阅读感受",
    categories: ["漫画"],
    previewColors: ["#ffffff", "#1a1a1a", "#f0f0f0", "#e5e5e5", "#333333"],
    downloadCount: 8340,
    rating: 4.4,
    themeData: {
      name: "漫画纯白",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      selectionColor: "#e0e0e0",
    },
  },
  {
    id: "market-forest-mist",
    name: "森林薄雾",
    author: "自然之息",
    description: "淡绿基底，深绿文字，仿佛在晨雾弥漫的森林中阅读",
    categories: ["护眼", "亮色"],
    previewColors: ["#dce8dc", "#2d4a22", "#b5ccb0", "#5a7d4a", "#1a3d12"],
    downloadCount: 6190,
    rating: 4.7,
    themeData: {
      name: "森林薄雾",
      backgroundColor: "#dce8dc",
      textColor: "#2d4a22",
      selectionColor: "#b5ccb0",
    },
  },
  {
    id: "market-obsidian-night",
    name: "曜石深黑",
    author: "极夜设计",
    description: "纯黑 OLED 背景，低亮度灰白文字，极致省电且护眼",
    categories: ["暗色"],
    previewColors: ["#000000", "#b0b0b0", "#1a1a1a", "#4a4a4a", "#e0e0e0"],
    downloadCount: 11200,
    rating: 4.9,
    themeData: {
      name: "曜石深黑",
      backgroundColor: "#000000",
      textColor: "#b0b0b0",
      selectionColor: "#4a4a4a",
    },
  },
  {
    id: "market-sepia-aged",
    name: "岁月旧纸",
    author: "藏书阁",
    description: "仿旧书纸质感的暖棕底色，适合阅读历史、传记类书籍",
    categories: ["护眼", "亮色"],
    previewColors: ["#e8d5b7", "#4a3728", "#c4a882", "#8b6f55", "#2d1f14"],
    downloadCount: 4680,
    rating: 4.5,
    themeData: {
      name: "岁月旧纸",
      backgroundColor: "#e8d5b7",
      textColor: "#4a3728",
      selectionColor: "#c4a882",
    },
  },
  {
    id: "market-comic-noir",
    name: "漫画暗夜",
    author: "二次元工坊",
    description: "暗灰背景配纯白文字，专为黑白漫画优化，视觉冲击力强",
    categories: ["漫画", "暗色"],
    previewColors: ["#1e1e1e", "#f0f0f0", "#2d2d2d", "#5a5a5a", "#d0d0d0"],
    downloadCount: 3950,
    rating: 4.3,
    themeData: {
      name: "漫画暗夜",
      backgroundColor: "#1e1e1e",
      textColor: "#f0f0f0",
      selectionColor: "#5a5a5a",
    },
  },
  {
    id: "market-lavender-dusk",
    name: "薰衣草暮",
    author: "紫霞苑",
    description: "浅紫底色配深紫文字，梦幻浪漫，适合言情小说阅读",
    categories: ["亮色"],
    previewColors: ["#f3f0ff", "#4a3f8b", "#d4cef0", "#7c6eb8", "#2a1f5e"],
    downloadCount: 3280,
    rating: 4.4,
    themeData: {
      name: "薰衣草暮",
      backgroundColor: "#f3f0ff",
      textColor: "#4a3f8b",
      selectionColor: "#d4cef0",
    },
  },
];

const ALL_CATEGORIES: ThemeCategory[] = ["全部", "暗色", "亮色", "护眼", "漫画"];

export function useThemeMarket() {
  const selectedCategory = ref<ThemeCategory>("全部");
  const loading = ref(false);
  const importedIds = ref(getImportedThemeIds());

  function fetchThemes(): Promise<ThemeItem[]> {
    loading.value = true;
    return new Promise((resolve) => {
      setTimeout(() => {
        loading.value = false;
        resolve([...CURATED_THEMES]);
      }, 400);
    });
  }

  const filteredThemes = computed(() => {
    if (selectedCategory.value === "全部") {
      return CURATED_THEMES;
    }
    return CURATED_THEMES.filter((t) =>
      t.categories.includes(selectedCategory.value),
    );
  });

  function filterByCategory(category: ThemeCategory) {
    selectedCategory.value = category;
  }

  function handleImportTheme(item: ThemeItem): boolean {
    try {
      const readerStore = useReaderSettingsStore();
      readerStore.setTheme({ ...item.themeData });
      markThemeImported(item.id);
      importedIds.value = getImportedThemeIds();
      return true;
    } catch (e) {
      console.error("导入主题失败:", e);
      return false;
    }
  }

  function isImported(themeId: string): boolean {
    return importedIds.value.has(themeId);
  }

  function handleApplyTheme(item: ThemeItem): boolean {
    try {
      const readerStore = useReaderSettingsStore();
      readerStore.setTheme({ ...item.themeData });
      return true;
    } catch (e) {
      console.error("应用主题失败:", e);
      return false;
    }
  }

  async function exportThemeForShare(theme: ReaderTheme): Promise<boolean> {
    try {
      const exportData = {
        name: theme.name,
        colors: {
          backgroundColor: theme.backgroundColor,
          textColor: theme.textColor,
          selectionColor: theme.selectionColor,
        },
        exportedAt: Date.now(),
        version: "1.0",
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      await copyText(jsonStr);
      return true;
    } catch {
      return false;
    }
  }

  return {
    CURATED_THEMES,
    ALL_CATEGORIES,
    selectedCategory,
    loading,
    filteredThemes,
    fetchThemes,
    filterByCategory,
    handleImportTheme,
    isImported,
    handleApplyTheme,
    exportThemeForShare,
  };
}