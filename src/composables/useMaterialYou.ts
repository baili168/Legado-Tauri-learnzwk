import { ref, watch } from 'vue';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface PresetColor {
  name: string;
  color: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  mode: 'advanced' | 'plugin';
  pluginId?: string;
  colors: Record<string, string>;
  createdAt: number;
}

const STORAGE_MODE_KEY = 'legado-material-you-mode';
const STORAGE_COLOR_KEY = 'legado-material-you-color';
const STORAGE_CUSTOM_THEMES_KEY = 'legado-custom-themes';
const STORAGE_CUSTOM_THEME_ID_KEY = 'legado-material-you-theme-id';

const pluginThemes = new Map<string, CustomTheme>();

export function registerPluginGlobalTheme(theme: CustomTheme): void {
  pluginThemes.set(theme.id, theme);
}

export function unregisterPluginGlobalTheme(themeId: string): void {
  pluginThemes.delete(themeId);
}

export function getPluginThemeRegistry(): Map<string, CustomTheme> {
  return pluginThemes;
}

function _listCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_THEMES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomTheme[];
  } catch {
    return [];
  }
}

function _saveCustomThemes(themes: CustomTheme[]): void {
  try {
    localStorage.setItem(STORAGE_CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {}
}

function _importTheme(json: string): CustomTheme {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('无效的主题格式：无法解析 JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('无效的主题格式：内容必须是对象');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name) {
    throw new Error('无效的主题格式：缺少 name 字段');
  }

  if (!obj.colors || typeof obj.colors !== 'object') {
    throw new Error('无效的主题格式：缺少 colors 字段');
  }

  const colors = obj.colors as Record<string, unknown>;
  if (typeof colors.primary !== 'string' || !colors.primary) {
    throw new Error('无效的主题格式：colors 中至少需要 primary 字段');
  }

  const theme: CustomTheme = {
    id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name: obj.name,
    mode: 'advanced',
    colors: colors as Record<string, string>,
    createdAt: Date.now(),
  };

  const themes = _listCustomThemes();
  themes.push(theme);
  _saveCustomThemes(themes);

  return theme;
}

const PRESETS: PresetColor[] = [
  { name: 'Indigo', color: '#4467FF' },
  { name: 'Rose', color: '#E11D48' },
  { name: 'Emerald', color: '#059669' },
  { name: 'Amber', color: '#D97706' },
  { name: 'Teal', color: '#0D9488' },
  { name: 'Violet', color: '#7C3AED' },
  { name: 'Crimson', color: '#DC2626' },
  { name: 'Slate', color: '#64748B' },
];

const LIGHT_TONES: Record<string, number> = {
  primary: 40,
  onPrimary: 100,
  primaryContainer: 90,
  onPrimaryContainer: 10,
  secondary: 40,
  onSecondary: 100,
  secondaryContainer: 95,
  tertiary: 40,
  surface: 98,
  onSurface: 10,
  surfaceVariant: 90,
  onSurfaceVariant: 30,
  error: 40,
  onError: 100,
  outline: 50,
};

const DARK_TONES: Record<string, number> = {
  primary: 80,
  onPrimary: 20,
  primaryContainer: 30,
  onPrimaryContainer: 90,
  secondary: 80,
  onSecondary: 20,
  secondaryContainer: 30,
  tertiary: 80,
  surface: 6,
  onSurface: 90,
  surfaceVariant: 30,
  onSurfaceVariant: 80,
  error: 80,
  onError: 20,
  outline: 60,
};

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case nr:
      h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6;
      break;
    case ng:
      h = ((nb - nr) / d + 2) / 6;
      break;
    case nb:
      h = ((nr - ng) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const ns = s / 100;
  const nl = l / 100;
  const a = ns * Math.min(nl, 1 - nl);

  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const color = nl - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

function clampTone(tone: number): number {
  return Math.max(0, Math.min(100, tone));
}

export function useMaterialYou() {
  const currentMode = ref<'system' | 'preset' | 'custom'>('preset');
  const currentColor = ref<string>(PRESETS[0].color);
  const currentCustomThemeId = ref<string | null>(null);
  const isDark = ref(false);

  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function updateDarkState() {
    isDark.value = darkMediaQuery.matches;
  }

  updateDarkState();
  darkMediaQuery.addEventListener('change', updateDarkState);

  function computeBrightness(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  function adjustSeedForReadability(seedHex: string): string {
    const brightness = computeBrightness(seedHex);
    const hsl = rgbToHsl(hexToRgb(seedHex).r, hexToRgb(seedHex).g, hexToRgb(seedHex).b);

    if (brightness < 50) {
      return hslToHex(hsl.h, hsl.s, 36);
    }
    if (brightness > 200) {
      return hslToHex(hsl.h, Math.max(hsl.s - 5, 10), 44);
    }
    return seedHex;
  }

  function createTonalPalette(seedHex: string): (tone: number) => string {
    const { h, s } = rgbToHsl(hexToRgb(seedHex).r, hexToRgb(seedHex).g, hexToRgb(seedHex).b);

    return (tone: number): string => {
      const t = clampTone(tone);
      const chromaPeak = Math.sin((t / 100) * Math.PI);
      const adjustedS = s * (0.3 + 0.7 * chromaPeak);
      return hslToHex(h, adjustedS, t);
    };
  }

  function generatePalette(seedHex: string): Record<string, string> {
    const adjustedSeed = adjustSeedForReadability(seedHex);
    const palette = createTonalPalette(adjustedSeed);
    const tones = isDark.value ? DARK_TONES : LIGHT_TONES;

    const result: Record<string, string> = {};
    for (const [key, tone] of Object.entries(tones)) {
      result[key] = palette(tone);
    }

    const surface = tones.surface;
    const onSurface = tones.onSurface;
    const surfaceVariant = tones.surfaceVariant;

    result.surfaceDim = palette(clampTone(surface - 2));
    result.surfaceBright = palette(clampTone(surface + 10));
    result.surfaceContainerLowest = palette(clampTone(surface - 4));
    result.surfaceContainerLow = palette(clampTone(surface - 2));
    result.surfaceContainer = palette(surface);
    result.surfaceContainerHigh = palette(clampTone(surface + 2));
    result.surfaceContainerHighest = palette(clampTone(surface + 4));

    result.tertiaryContainer = palette(90);
    result.onTertiaryContainer = palette(10);
    result.errorContainer = palette(90);
    result.onErrorContainer = palette(10);
    result.outlineVariant = palette(80);

    result.background = palette(isDark.value ? 6 : 98);
    result.onBackground = palette(isDark.value ? 90 : 10);
    result.inverseSurface = palette(isDark.value ? 90 : 20);
    result.inverseOnSurface = palette(isDark.value ? 20 : 95);
    result.inversePrimary = palette(isDark.value ? 40 : 80);

    if (isDark.value) {
      result.surfaceTint = palette(80);
    } else {
      result.surfaceTint = palette(40);
    }

    return result;
  }

  function applyCssVariables(palette: Record<string, string>) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(palette)) {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(`--md-sys-color-${cssKey}`, value);
    }
  }

  function persist(mode: 'system' | 'preset' | 'custom', color?: string) {
    try {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
      if (color) {
        localStorage.setItem(STORAGE_COLOR_KEY, color);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing), silently ignore
    }
  }

  function applyTheme(mode: 'system' | 'preset' | 'custom', color?: string) {
    currentMode.value = mode;

    let seedColor: string;

    if (mode === 'system') {
      seedColor = PRESETS[0].color;
    } else if (mode === 'preset') {
      seedColor = color || currentColor.value;
    } else {
      seedColor = color || currentColor.value;
    }

    currentColor.value = seedColor;
    const palette = generatePalette(seedColor);
    applyCssVariables(palette);
    persist(mode, color);

    if (mode === 'preset' && color) {
      persist(mode, color);
    } else if (mode === 'custom' && color) {
      persist(mode, color);
    } else {
      persist(mode);
    }
  }

  function listCustomThemes(): CustomTheme[] {
    return _listCustomThemes();
  }

  function saveCustomThemes(themes: CustomTheme[]): void {
    _saveCustomThemes(themes);
  }

  function importTheme(json: string): CustomTheme {
    return _importTheme(json);
  }

  function exportTheme(themeId: string): string {
    const themes = listCustomThemes();
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) {
      throw new Error(`主题未找到: ${themeId}`);
    }
    return JSON.stringify({
      name: theme.name,
      colors: theme.colors,
      exportedAt: Date.now(),
    });
  }

  function deleteTheme(themeId: string): void {
    const themes = listCustomThemes();
    const filtered = themes.filter((t) => t.id !== themeId);
    saveCustomThemes(filtered);

    const activeThemeId = (() => {
      try {
        return localStorage.getItem(STORAGE_CUSTOM_THEME_ID_KEY);
      } catch {
        return null;
      }
    })();

    if (activeThemeId === themeId) {
      applyTheme('preset', PRESETS[0].color);
      try {
        localStorage.removeItem(STORAGE_CUSTOM_THEME_ID_KEY);
      } catch {}
      currentCustomThemeId.value = null;
    }
  }

  function activateTheme(themeId: string): void {
    const pluginTheme = pluginThemes.get(themeId);
    if (pluginTheme) {
      currentMode.value = 'custom';
      currentCustomThemeId.value = themeId;
      applyCssVariables(pluginTheme.colors);
      persist('custom');
      try {
        localStorage.setItem(STORAGE_CUSTOM_THEME_ID_KEY, themeId);
      } catch {}
      return;
    }

    const themes = listCustomThemes();
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) {
      throw new Error(`主题未找到: ${themeId}`);
    }

    currentMode.value = 'custom';
    currentCustomThemeId.value = themeId;
    applyCssVariables(theme.colors);
    persist('custom');
    try {
      localStorage.setItem(STORAGE_CUSTOM_THEME_ID_KEY, themeId);
    } catch {}
  }

  function registerGlobalTheme(theme: CustomTheme): void {
    registerPluginGlobalTheme(theme);
  }

  function unregisterGlobalTheme(themeId: string): void {
    unregisterPluginGlobalTheme(themeId);

    const activeThemeId = (() => {
      try {
        return localStorage.getItem(STORAGE_CUSTOM_THEME_ID_KEY);
      } catch {
        return null;
      }
    })();

    if (activeThemeId === themeId) {
      applyTheme('preset', PRESETS[0].color);
      try {
        localStorage.removeItem(STORAGE_CUSTOM_THEME_ID_KEY);
      } catch {}
      currentCustomThemeId.value = null;
    }
  }

  function getPluginThemes(): CustomTheme[] {
    return Array.from(pluginThemes.values());
  }

  function getPresets(): PresetColor[] {
    return PRESETS;
  }

  function initFromStorage() {
    try {
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY) as
        | 'system'
        | 'preset'
        | 'custom'
        | null;
      const savedColor = localStorage.getItem(STORAGE_COLOR_KEY);
      const savedThemeId = localStorage.getItem(STORAGE_CUSTOM_THEME_ID_KEY);

      if (savedMode === 'custom' && savedThemeId) {
        const pluginTheme = pluginThemes.get(savedThemeId);
        if (pluginTheme) {
          currentMode.value = 'custom';
          currentCustomThemeId.value = savedThemeId;
          applyCssVariables(pluginTheme.colors);
          return;
        }

        const themes = listCustomThemes();
        const theme = themes.find((t) => t.id === savedThemeId);
        if (theme) {
          currentMode.value = 'custom';
          currentCustomThemeId.value = savedThemeId;
          applyCssVariables(theme.colors);
          return;
        }

        applyTheme('preset', PRESETS[0].color);
        try {
          localStorage.removeItem(STORAGE_CUSTOM_THEME_ID_KEY);
        } catch {}
        return;
      }

      if (savedMode) {
        currentMode.value = savedMode;
        if (savedColor) {
          currentColor.value = savedColor;
        }
        applyTheme(savedMode, savedColor || undefined);
      } else {
        applyTheme('preset', PRESETS[0].color);
      }
    } catch {
      applyTheme('preset', PRESETS[0].color);
    }
  }

  watch(isDark, () => {
    if (currentCustomThemeId.value) {
      const pluginTheme = pluginThemes.get(currentCustomThemeId.value);
      if (pluginTheme) {
        applyCssVariables(pluginTheme.colors);
        return;
      }
      const themes = listCustomThemes();
      const theme = themes.find((t) => t.id === currentCustomThemeId.value);
      if (theme) {
        applyCssVariables(theme.colors);
        return;
      }
    }
    const palette = generatePalette(currentColor.value);
    applyCssVariables(palette);
  });

  return {
    currentMode,
    currentColor,
    currentCustomThemeId,
    isDark,
    applyTheme,
    getPresets,
    initFromStorage,
    listCustomThemes,
    importTheme,
    exportTheme,
    deleteTheme,
    activateTheme,
    registerGlobalTheme,
    unregisterGlobalTheme,
    getPluginThemes,
  };
}

export { _listCustomThemes as listCustomThemes, _saveCustomThemes as saveCustomThemes, _importTheme as importTheme };