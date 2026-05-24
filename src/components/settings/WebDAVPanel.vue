<script setup lang="ts">
import { NButton, NInput, NSelect, NSwitch, useMessage } from "naive-ui"
import { computed, onMounted, ref } from "vue"
import { ensureFrontendNamespaceLoaded, listFrontendStorageNamespaces, setFrontendStorageItem } from "@/composables/useFrontendStorage"
import { useAppConfigStore, useWebDAVConfigStore } from "@/stores"
import type { WebDAVBackupConfig } from "@/stores"
import SettingItem from "./SettingItem.vue"
import SettingSection from "./SettingSection.vue"
import {
  downloadFile,
  listFiles,
  testConnection,
  uploadFile,
  downloadManifest,
  uploadManifest,
  extractBookEntries,
  getIncrementalChanges,
  buildManifestFromEntries,
  uploadIncremental,
  downloadIncremental,
  buildIncrementalBackupJson,
  type BookSyncEntry,
} from "@/services/webdavClient"
import {
  detectConflicts,
  resolveConflicts,
  type ConflictStrategy,
  type BookConflict,
  type ResolvedBook,
} from "@/composables/useSyncConflictResolver"

interface SyncHistoryEntry {
  timestamp: number
  status: "success" | "partial" | "error"
  booksUpdated: number
  conflictsResolved: number
  mode: "full" | "incremental"
  summary: string
}

const HISTORY_STORAGE_KEY = "legado-webdav-sync-history"

const message = useMessage()
const appCfg = useAppConfigStore()
const store = useWebDAVConfigStore()

const url = ref("")
const username = ref("")
const password = ref("")
const testing = ref(false)
const backingUp = ref(false)
const restoring = ref(false)
const loadingFiles = ref(false)
const backupFiles = ref<string[]>([])
const restoringFile = ref("")

const incrementalSyncEnabled = ref(false)
const conflictStrategy = ref<ConflictStrategy>("latest-progress")
const syncingIncremental = ref(false)
const syncSummary = ref<{
  booksUpdated: number
  booksDownloaded: number
  conflictsDetected: number
  conflictsResolved: number
  errors: string[]
} | null>(null)
const syncConflicts = ref<BookConflict[]>([])
const syncHistory = ref<SyncHistoryEntry[]>([])

const conflictStrategyOptions = [
  { label: "进度优先", value: "latest-progress" as ConflictStrategy },
  { label: "本地优先", value: "local-wins" as ConflictStrategy },
  { label: "云端优先", value: "remote-wins" as ConflictStrategy },
]

const configValid = computed(() => url.value.trim() && username.value.trim() && password.value)

function getCurrentConfig(): WebDAVBackupConfig {
  return {
    url: url.value.trim(),
    username: username.value.trim(),
    password: password.value,
  }
}

function formatTime(ts: number): string {
  if (!ts) {
    return "从未"
  }
  return new Date(ts).toLocaleString()
}

function formatDateLabel(filename: string): string {
  const match = filename.match(/legado-backup-(\d{4})(\d{2})(\d{2})\.json/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }
  return filename
}

async function handleTestConnection() {
  testing.value = true
  try {
    const ok = await testConnection(getCurrentConfig())
    if (ok) {
      message.success("连接成功")
    } else {
      message.error("连接失败，请检查地址和账号密码")
    }
  } catch (e: unknown) {
    message.error(`连接测试异常: ${e}`)
  } finally {
    testing.value = false
  }
}

async function collectBackupData(): Promise<string> {
  const localStorageData: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value !== null) {
          localStorageData[key] = value
        }
      }
    }
  } catch {
    /* ignore */
  }

  let frontendNamespaces: Array<{ namespace: string; count: number }> = []
  try {
    frontendNamespaces = await listFrontendStorageNamespaces()
  } catch {
    /* ignore */
  }

  const frontendData: Record<string, Record<string, string>> = {}
  for (const ns of frontendNamespaces) {
    try {
      const entries = await ensureFrontendNamespaceLoaded(ns.namespace)
      frontendData[ns.namespace] = { ...entries }
    } catch {
      /* ignore */
    }
  }

  await appCfg.loadConfig()
  const backup = {
    version: 1,
    timestamp: Date.now(),
    appConfig: appCfg.config,
    localStorage: localStorageData,
    frontendStorage: frontendData,
  }

  return JSON.stringify(backup, null, 2)
}

async function handleBackupNow() {
  backingUp.value = true
  try {
    store.saveConfig(getCurrentConfig())
    const content = await collectBackupData()
    const now = new Date()
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("")
    const fileName = `legado-backup-${dateStr}.json`
    await uploadFile(getCurrentConfig(), fileName, content)
    const ts = Date.now()
    store.saveLastBackupAt(ts)
    message.success(`备份成功: ${fileName}`)
    await refreshFileList()
  } catch (e: unknown) {
    message.error(`备份失败: ${e}`)
  } finally {
    backingUp.value = false
  }
}

async function handleRestore(fileName: string) {
  restoring.value = true
  restoringFile.value = fileName
  try {
    const raw = await downloadFile(getCurrentConfig(), fileName)
    const backup = JSON.parse(raw)

    if (backup.localStorage) {
      for (const [key, value] of Object.entries(backup.localStorage)) {
        try {
          localStorage.setItem(key, value as string)
        } catch {
          /* ignore */
        }
      }
    }

    let restoredCount = 0
    if (backup.frontendStorage) {
      for (const [namespace, entries] of Object.entries(backup.frontendStorage)) {
        for (const [key, value] of Object.entries(entries as Record<string, string>)) {
          try {
            setFrontendStorageItem(namespace, key, value)
            restoredCount++
          } catch {
            /* ignore */
          }
        }
      }
    }

    if (backup.appConfig) {
      await appCfg.loadConfig()
    }

    message.success(`恢复成功: ${fileName}${restoredCount ? ` (${restoredCount} 项数据)` : ""}`)
  } catch (e: unknown) {
    message.error(`恢复失败: ${e}`)
  } finally {
    restoring.value = false
    restoringFile.value = ""
  }
}

async function refreshFileList() {
  if (!configValid.value) {
    return
  }
  loadingFiles.value = true
  try {
    backupFiles.value = await listFiles(getCurrentConfig())
  } catch {
    backupFiles.value = []
  } finally {
    loadingFiles.value = false
  }
}

function loadSyncHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (raw) {
      syncHistory.value = JSON.parse(raw) as SyncHistoryEntry[]
    }
  } catch {
    syncHistory.value = []
  }
}

function saveSyncHistory(entry: SyncHistoryEntry) {
  syncHistory.value.unshift(entry)
  if (syncHistory.value.length > 5) {
    syncHistory.value = syncHistory.value.slice(0, 5)
  }
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(syncHistory.value))
  } catch {
    /* ignore */
  }
}

function formatSyncTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatSyncStatus(status: string): string {
  switch (status) {
    case "success": return "成功"
    case "partial": return "部分成功"
    case "error": return "失败"
    default: return status
  }
}

async function handleIncrementalSync() {
  syncingIncremental.value = true
  syncSummary.value = null
  syncConflicts.value = []

  try {
    store.saveConfig(getCurrentConfig())
    const content = await collectBackupData()
    const localEntries = extractBookEntries(content)

    const remoteManifest = await downloadManifest(getCurrentConfig())

    if (!remoteManifest) {
      const manifest = buildManifestFromEntries(localEntries)
      await uploadManifest(getCurrentConfig(), manifest)

      const result = await uploadIncremental(getCurrentConfig(), localEntries)

      syncSummary.value = {
        booksUpdated: result.uploaded,
        booksDownloaded: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        errors: result.errors,
      }

      saveSyncHistory({
        timestamp: Date.now(),
        status: result.errors.length > 0 ? "partial" : "success",
        booksUpdated: result.uploaded,
        conflictsResolved: 0,
        mode: "incremental",
        summary: `首次增量同步：上传 ${result.uploaded} 本书`,
      })

      message.success(`增量同步完成：上传 ${result.uploaded} 本书`)
      return
    }

    const changes = getIncrementalChanges(localEntries, remoteManifest)

    let remoteEntries: BookSyncEntry[] = []
    if (changes.toDownload.length > 0) {
      remoteEntries = await downloadIncremental(getCurrentConfig(), changes.toDownload)
    }

    const conflicts = detectConflicts(localEntries, remoteEntries)
    const resolved = resolveConflicts(conflicts, conflictStrategy.value)

    const mergedEntries = new Map<string, BookSyncEntry>()
    for (const entry of localEntries) {
      const id = entry.bookId || entry.bookUrl
      mergedEntries.set(id, entry)
    }

    for (const r of resolved) {
      const id = r.entry.bookId || r.entry.bookUrl
      mergedEntries.set(id, r.entry)
    }

    for (const entry of remoteEntries) {
      const id = entry.bookId || entry.bookUrl
      if (!mergedEntries.has(id)) {
        mergedEntries.set(id, entry)
      }
    }

    const allMerged = [...mergedEntries.values()]
    const updatedEntries = allMerged.filter((e) => {
      const id = e.bookId || e.bookUrl
      const local = localEntries.find((l) => (l.bookId || l.bookUrl) === id)
      return !local || local.lastReadAt !== e.lastReadAt
    })

    let booksUpdated = 0
    const errors: string[] = []

    if (changes.toUpload.length > 0) {
      const uploadResult = await uploadIncremental(getCurrentConfig(), changes.toUpload)
      booksUpdated += uploadResult.uploaded
      errors.push(...uploadResult.errors)
    }

    if (remoteEntries.length > 0) {
      const mergedBackupJson = buildIncrementalBackupJson(updatedEntries, content)
      await uploadFile(
        getCurrentConfig(),
        `legado-backup-incremental-${Date.now()}.json`,
        mergedBackupJson,
      )
    }

    const newManifest = buildManifestFromEntries(allMerged)
    await uploadManifest(getCurrentConfig(), newManifest)

    syncConflicts.value = conflicts
    syncSummary.value = {
      booksUpdated,
      booksDownloaded: remoteEntries.length,
      conflictsDetected: conflicts.length,
      conflictsResolved: resolved.length,
      errors,
    }

    saveSyncHistory({
      timestamp: Date.now(),
      status: errors.length > 0 ? "partial" : "success",
      booksUpdated: booksUpdated + remoteEntries.length,
      conflictsResolved: resolved.length,
      mode: "incremental",
      summary: `更新 ${booksUpdated} 本，下载 ${remoteEntries.length} 本，解决 ${resolved.length} 个冲突`,
    })

    message.success(
      `增量同步完成：上传 ${booksUpdated} 本，下载 ${remoteEntries.length} 本，冲突 ${resolved.length} 个`,
    )
  } catch (e: unknown) {
    message.error(`增量同步失败: ${e}`)
    saveSyncHistory({
      timestamp: Date.now(),
      status: "error",
      booksUpdated: 0,
      conflictsResolved: 0,
      mode: "incremental",
      summary: `错误: ${e}`,
    })
  } finally {
    syncingIncremental.value = false
  }
}

onMounted(() => {
  store.loadConfig()
  url.value = store.url
  username.value = store.username
  password.value = store.password
  loadSyncHistory()
})
</script>

<template>
  <SettingSection title="WebDAV 备份" section-id="section-webdav-backup">
    <SettingItem label="WebDAV 地址" desc="例如 https://dav.jianguoyun.com/dav/">
      <n-input
        v-model:value="url"
        size="small"
        placeholder="https://..."
        style="flex: 1"
      />
    </SettingItem>

    <SettingItem label="账号">
      <n-input
        v-model:value="username"
        size="small"
        placeholder="用户名"
        style="flex: 1"
      />
    </SettingItem>

    <SettingItem label="密码 / Token">
      <n-input
        v-model:value="password"
        size="small"
        type="password"
        show-password-on="click"
        placeholder="WebDAV 密码或应用 Token"
        style="flex: 1"
      />
    </SettingItem>

    <SettingItem
      label="连接测试与备份"
      :desc="`上次备份时间：${formatTime(store.lastBackupAt)}`"
    >
      <n-button
        size="small"
        :loading="testing"
        :disabled="!configValid"
        @click="handleTestConnection"
      >
        测试连接
      </n-button>
      <n-button
        size="small"
        type="primary"
        :loading="backingUp"
        :disabled="!configValid"
        @click="handleBackupNow"
      >
        立即备份
      </n-button>
    </SettingItem>

    <SettingItem
      label="增量同步"
      desc="开启后仅同步自上次同步后有变动的书籍进度，默认执行完整备份"
    >
      <n-switch
        v-model:value="incrementalSyncEnabled"
        :disabled="!configValid"
      />
    </SettingItem>

    <SettingItem
      v-if="incrementalSyncEnabled"
      label="冲突解决策略"
      desc="多设备同步时书籍进度冲突的处理方式"
    >
      <n-select
        v-model:value="conflictStrategy"
        size="small"
        :options="conflictStrategyOptions"
        style="width: 140px"
      />
      <n-button
        size="small"
        type="primary"
        :loading="syncingIncremental"
        :disabled="!configValid"
        @click="handleIncrementalSync"
      >
        增量同步
      </n-button>
    </SettingItem>

    <SettingItem
      v-if="syncSummary"
      label="同步结果"
      :vertical="true"
    >
      <div class="incremental-summary">
        <div class="summary-row">
          <span class="summary-label">上传书籍</span>
          <span class="summary-value">{{ syncSummary.booksUpdated }} 本</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">下载书籍</span>
          <span class="summary-value">{{ syncSummary.booksDownloaded }} 本</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">检测冲突</span>
          <span class="summary-value">{{ syncSummary.conflictsDetected }} 个</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">已解决冲突</span>
          <span class="summary-value">{{ syncSummary.conflictsResolved }} 个</span>
        </div>
        <div v-if="syncSummary.errors.length > 0" class="summary-errors">
          <span class="summary-label">错误</span>
          <div v-for="(err, idx) in syncSummary.errors" :key="idx" class="summary-error-item">
            {{ err }}
          </div>
        </div>
      </div>
    </SettingItem>

    <div v-if="syncConflicts.length > 0" class="sync-conflicts">
      <div class="sync-conflicts-title">冲突详情</div>
      <div
        v-for="conflict in syncConflicts"
        :key="conflict.bookId"
        class="sync-conflict-item"
      >
        <span class="conflict-book-name">{{ conflict.name }}</span>
        <span class="conflict-detail">
          本地进度 {{ (conflict.localProgress * 100).toFixed(1) }}%
          vs 云端进度 {{ (conflict.remoteProgress * 100).toFixed(1) }}%
        </span>
        <span class="conflict-resolution">
          采用: {{ conflict.localProgress >= conflict.remoteProgress ? '本地' : '云端' }}
        </span>
      </div>
    </div>

    <SettingItem
      label="同步历史"
      desc="最近 5 次增量同步操作记录"
      :vertical="true"
    >
      <div v-if="syncHistory.length === 0" class="webdav-empty">
        暂无同步记录
      </div>
      <div v-else class="sync-history-list">
        <div
          v-for="entry in syncHistory"
          :key="entry.timestamp"
          class="sync-history-item"
        >
          <span class="history-time">{{ formatSyncTimestamp(entry.timestamp) }}</span>
          <span
            class="history-status"
            :class="{
              'history-status--success': entry.status === 'success',
              'history-status--partial': entry.status === 'partial',
              'history-status--error': entry.status === 'error',
            }"
          >
            {{ formatSyncStatus(entry.status) }}
          </span>
          <span class="history-mode">{{ entry.mode === 'incremental' ? '增量' : '完整' }}</span>
          <span class="history-summary">{{ entry.summary }}</span>
        </div>
      </div>
    </SettingItem>

    <SettingItem label="从备份恢复" desc="选择远程 WebDAV 上的备份文件进行恢复" :vertical="true">
      <div class="webdav-restore-toolbar">
        <n-button
          size="small"
          :loading="loadingFiles"
          :disabled="!configValid"
          @click="refreshFileList"
        >
          刷新备份列表
        </n-button>
      </div>

      <div v-if="backupFiles.length === 0 && !loadingFiles" class="webdav-empty">
        暂无备份文件
      </div>

      <div v-else class="webdav-file-list">
        <div
          v-for="file in backupFiles"
          :key="file"
          class="webdav-file-item"
        >
          <span class="webdav-file-name">{{ formatDateLabel(file) }}</span>
          <span class="webdav-file-raw">{{ file }}</span>
          <n-button
            size="tiny"
            type="warning"
            :loading="restoring && restoringFile === file"
            @click="handleRestore(file)"
          >
            恢复
          </n-button>
        </div>
      </div>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.webdav-restore-toolbar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.webdav-empty {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--fs-13);
}

.webdav-file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.webdav-file-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
}

.webdav-file-name {
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  color: var(--color-text);
}

.webdav-file-raw {
  flex: 1;
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.incremental-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) 0;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.summary-label {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  min-width: 72px;
}

.summary-value {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--color-text);
}

.summary-errors {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.summary-error-item {
  font-size: var(--fs-11);
  color: var(--color-error, #d03050);
  padding: 2px 0;
}

.sync-conflicts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
}

.sync-conflicts-title {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  margin-bottom: 2px;
}

.sync-conflict-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  background: var(--color-fill, rgba(128, 128, 128, 0.04));
}

.conflict-book-name {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--color-text);
}

.conflict-detail {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
}

.conflict-resolution {
  font-size: var(--fs-11);
  color: var(--color-primary, #2080f0);
}

.sync-history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}

.sync-history-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  flex-wrap: wrap;
}

.history-time {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.history-status {
  font-size: var(--fs-11);
  font-weight: var(--fw-medium);
  padding: 1px 6px;
  border-radius: 3px;
}

.history-status--success {
  color: var(--color-success, #18a058);
  background: color-mix(in srgb, var(--color-success, #18a058) 12%, transparent);
}

.history-status--partial {
  color: var(--color-warning, #f0a020);
  background: color-mix(in srgb, var(--color-warning, #f0a020) 12%, transparent);
}

.history-status--error {
  color: var(--color-error, #d03050);
  background: color-mix(in srgb, var(--color-error, #d03050) 12%, transparent);
}

.history-mode {
  font-size: var(--fs-10);
  color: var(--color-text-muted);
  padding: 1px 5px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  white-space: nowrap;
}

.history-summary {
  flex: 1;
  font-size: var(--fs-11);
  color: var(--color-text-soft);
  min-width: 120px;
}
</style>