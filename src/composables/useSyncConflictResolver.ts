import type { BookSyncEntry } from "@/services/webdavClient"

export type ConflictStrategy = "local-wins" | "remote-wins" | "latest-progress" | "manual"

export interface BookConflict {
  bookId: string
  bookUrl: string
  name: string
  local: BookSyncEntry
  remote: BookSyncEntry
  localProgress: number
  remoteProgress: number
}

export interface ResolvedBook {
  entry: BookSyncEntry
  source: "local" | "remote" | "merged"
}

export function detectConflicts(
  localEntries: BookSyncEntry[],
  remoteEntries: BookSyncEntry[],
): BookConflict[] {
  const conflicts: BookConflict[] = []
  const remoteMap = new Map<string, BookSyncEntry>()

  for (const r of remoteEntries) {
    const id = r.bookId || r.bookUrl
    if (id) {
      remoteMap.set(id, r)
    }
  }

  for (const local of localEntries) {
    const id = local.bookId || local.bookUrl
    const remote = remoteMap.get(id)

    if (!remote) continue

    const localProgress = computeProgress(local)
    const remoteProgress = computeProgress(remote)

    const hasChapterConflict = local.readChapterIndex !== remote.readChapterIndex
    const hasPageConflict = local.readPageIndex !== remote.readPageIndex
    const hasScrollConflict =
      Math.abs(local.readScrollRatio - remote.readScrollRatio) > 0.001
    const hasTimeConflict = local.lastReadAt !== remote.lastReadAt

    if (hasChapterConflict || hasPageConflict || hasScrollConflict || hasTimeConflict) {
      conflicts.push({
        bookId: id,
        bookUrl: local.bookUrl || remote.bookUrl,
        name: local.name || remote.name,
        local,
        remote,
        localProgress,
        remoteProgress,
      })
    }

    remoteMap.delete(id)
  }

  return conflicts
}

function computeProgress(entry: BookSyncEntry): number {
  if (entry.readChapterIndex >= 0 && entry.totalChapters > 0) {
    const chapterRatio = entry.readChapterIndex / Math.max(entry.totalChapters, 1)
    const pageRatio = Math.max(entry.readPageIndex, 0) / 100
    const scrollRatio = Math.max(entry.readScrollRatio, 0)
    return chapterRatio * 0.5 + pageRatio * 0.25 + scrollRatio * 0.25
  }

  const pageRatio = Math.max(entry.readPageIndex, 0) / 100
  const scrollRatio = Math.max(entry.readScrollRatio, 0)
  return pageRatio * 0.5 + scrollRatio * 0.5
}

export function resolveConflicts(
  conflicts: BookConflict[],
  strategy: ConflictStrategy,
): ResolvedBook[] {
  if (strategy === "manual") {
    return []
  }

  const resolved: ResolvedBook[] = []

  for (const conflict of conflicts) {
    switch (strategy) {
      case "local-wins":
        resolved.push({
          entry: conflict.local,
          source: "local",
        })
        break

      case "remote-wins":
        resolved.push({
          entry: conflict.remote,
          source: "remote",
        })
        break

      case "latest-progress":
        if (conflict.localProgress >= conflict.remoteProgress) {
          resolved.push({
            entry: conflict.local,
            source: "local",
          })
        } else {
          resolved.push({
            entry: conflict.remote,
            source: "remote",
          })
        }
        break
    }
  }

  return resolved
}

export function getManualConflicts(conflicts: BookConflict[]): BookConflict[] {
  return conflicts
}

export function resolveManualConflict(
  conflict: BookConflict,
  choice: "local" | "remote",
): ResolvedBook {
  return {
    entry: choice === "local" ? conflict.local : conflict.remote,
    source: choice,
  }
}