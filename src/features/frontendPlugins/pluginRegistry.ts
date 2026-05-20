import { registerPluginGlobalTheme, unregisterPluginGlobalTheme } from '@/composables/useMaterialYou';
import type { CustomTheme } from '@/composables/useMaterialYou';
import type { GlobalThemeDefinition } from './pluginTypes';

const pluginStyleMap = new Map<string, HTMLElement>();

export function activatePluginThemes(themes: GlobalThemeDefinition[], pluginId: string): void {
  if (!themes?.length) {
    return;
  }
  for (const themeDef of themes) {
    const theme: CustomTheme = {
      id: pluginId ? `plugin:${pluginId}:${themeDef.id}` : themeDef.id,
      name: themeDef.name,
      mode: 'plugin',
      pluginId,
      colors: themeDef.colors,
      createdAt: Date.now(),
    };
    registerPluginGlobalTheme(theme);
  }
}

export function deactivatePluginThemes(themes: GlobalThemeDefinition[], pluginId: string): void {
  if (!themes?.length) {
    return;
  }
  for (const themeDef of themes) {
    const themeId = pluginId ? `plugin:${pluginId}:${themeDef.id}` : themeDef.id;
    unregisterPluginGlobalTheme(themeId);
  }
}

export function injectCSS(pluginId: string, css: string, options?: { styleId?: string }): string {
  const styleId = options?.styleId ?? `plugin-css-${pluginId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  removeCSS(styleId);
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.dataset.pluginId = pluginId;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  pluginStyleMap.set(styleId, styleEl);
  return styleId;
}

export function removeCSS(styleId: string): void {
  const existing = pluginStyleMap.get(styleId);
  if (existing && existing.parentNode) {
    existing.remove();
  }
  pluginStyleMap.delete(styleId);
}

export function removeAllPluginCSS(pluginId: string): void {
  const toRemove: string[] = [];
  for (const [styleId, el] of pluginStyleMap) {
    if (el.dataset.pluginId === pluginId) {
      toRemove.push(styleId);
    }
  }
  toRemove.forEach(removeCSS);
}