import { defineStore } from "pinia"
import { ref } from "vue"

const STORAGE_KEY = "legado-webdav-backup-config"

export interface WebDAVBackupConfig {
  url: string
  username: string
  password: string
}

export const useWebDAVConfigStore = defineStore("webdavConfig", () => {
  const url = ref("")
  const username = ref("")
  const password = ref("")
  const lastBackupAt = ref(0)
  const loaded = ref(false)

  function loadConfig() {
    if (loaded.value) {
      return
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as WebDAVBackupConfig & { lastBackupAt?: number }
        url.value = data.url || ""
        username.value = data.username || ""
        password.value = data.password || ""
        lastBackupAt.value = data.lastBackupAt || 0
      }
    } catch {
      /* ignore parse errors */
    }
    loaded.value = true
  }

  function getConfig() {
    loadConfig()
    return {
      url: url.value,
      username: username.value,
      password: password.value,
    }
  }

  function saveConfig(config: WebDAVBackupConfig) {
    url.value = config.url
    username.value = config.username
    password.value = config.password
    persist()
  }

  function saveLastBackupAt(ts: number) {
    lastBackupAt.value = ts
    persist()
  }

  function clearConfig() {
    url.value = ""
    username.value = ""
    password.value = ""
    lastBackupAt.value = 0
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  function persist() {
    try {
      const data = {
        url: url.value,
        username: username.value,
        password: password.value,
        lastBackupAt: lastBackupAt.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* ignore quota errors */
    }
  }

  return {
    url,
    username,
    password,
    lastBackupAt,
    loaded,
    loadConfig,
    getConfig,
    saveConfig,
    saveLastBackupAt,
    clearConfig,
  }
})