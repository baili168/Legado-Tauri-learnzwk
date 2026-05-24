import { importTheme } from "@/composables/useMaterialYou";

export interface ThemeEntry {
  id: string;
  name: string;
  colors: Record<string, string>;
  preview?: string;
  description?: string;
}

export interface ThemeManifest {
  name: string;
  version: string;
  themes: ThemeEntry[];
}

export const DEFAULT_THEME_SOURCE_URL =
  "https://raw.githubusercontent.com/legado-themes/repository/main/manifest.json";

export function useOnlineThemeSource() {
  function validateManifest(data: unknown): ThemeManifest {
    if (!data || typeof data !== "object") {
      throw new Error("在线主题源格式无效：响应不是 JSON 对象");
    }
    const obj = data as Record<string, unknown>;
    if (typeof obj.name !== "string" || !obj.name.trim()) {
      throw new Error("在线主题源格式无效：缺少 name 字段");
    }
    if (!Array.isArray(obj.themes)) {
      throw new Error("在线主题源格式无效：缺少 themes 数组");
    }
    return {
      name: obj.name,
      version: typeof obj.version === "string" ? obj.version : "0.0.0",
      themes: obj.themes as ThemeEntry[],
    };
  }

  async function fetchThemeManifest(url: string): Promise<ThemeManifest> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`获取主题清单失败：HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
        throw new Error("获取主题清单失败：响应不是 JSON 格式");
      }

      const raw = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("获取主题清单失败：无法解析 JSON");
      }

      return validateManifest(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("获取主题清单超时（10 秒）");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function importThemeFromSource(entry: ThemeEntry): void {
    const themeJson = JSON.stringify({
      name: entry.name,
      colors: entry.colors,
    });
    importTheme(themeJson);
  }

  return {
    fetchThemeManifest,
    importThemeFromSource,
  };
}
