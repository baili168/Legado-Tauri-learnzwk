import { ref, computed } from "vue";
import { useMusicPlayerStore, type PlayerBookContext, type PlayerTrack, type PlayMode } from "@/stores";

export interface LocalAudioTrack {
  id: string;
  name: string;
  blobUrl: string;
  fileSize: number;
  duration?: number;
  format: string;
  addedAt: number;
}

const STORAGE_KEY = "local-audio-playlist-v1";

function generateId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

const localTracks = ref<LocalAudioTrack[]>([]);
const currentLocalIndex = ref(-1);
let restored = false;

function loadPlaylist(): LocalAudioTrack[] {
  if (restored) return localTracks.value;
  restored = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as LocalAudioTrack[];
      if (Array.isArray(data)) {
        const valid = data.filter(
          (t) => t.id && t.name && t.blobUrl && t.format,
        );
        localTracks.value = valid;
        currentLocalIndex.value = valid.length > 0 ? 0 : -1;
      }
    }
  } catch {
    localTracks.value = [];
  }
  return localTracks.value;
}

function savePlaylist(): void {
  try {
    const toSave = localTracks.value.map((t) => ({
      id: t.id,
      name: t.name,
      blobUrl: t.blobUrl,
      fileSize: t.fileSize,
      duration: t.duration,
      format: t.format,
      addedAt: t.addedAt,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    /* storage full or unavailable */
  }
}

export function useAudioPlaylist() {
  const player = useMusicPlayerStore();

  loadPlaylist();

  const playlist = computed<LocalAudioTrack[]>(() => localTracks.value);
  const currentIndex = computed(() => currentLocalIndex.value);
  const currentTrack = computed<LocalAudioTrack | null>(() => {
    if (currentLocalIndex.value < 0 || currentLocalIndex.value >= localTracks.value.length) {
      return null;
    }
    return localTracks.value[currentLocalIndex.value];
  });
  const hasLocalSession = computed(() => {
    if (localTracks.value.length > 0) return true;
    if (!player.book) return false;
    return player.book.fileName === "local-playlist";
  });

  function addLocalFile(file: File): LocalAudioTrack {
    const id = generateId();
    const format = (file.name.split(".").pop() ?? "").toLowerCase();
    const blobUrl = URL.createObjectURL(file);
    const track: LocalAudioTrack = {
      id,
      name: stripExt(file.name),
      blobUrl,
      fileSize: file.size,
      format,
      addedAt: Date.now(),
    };
    localTracks.value.push(track);
    savePlaylist();
    return track;
  }

  function addLocalFiles(files: File[]): LocalAudioTrack[] {
    return files.map((f) => addLocalFile(f));
  }

  function removeTrack(index: number): void {
    if (index < 0 || index >= localTracks.value.length) return;
    const track = localTracks.value[index];
    try {
      URL.revokeObjectURL(track.blobUrl);
    } catch {
      /* already revoked */
    }
    localTracks.value.splice(index, 1);
    if (currentLocalIndex.value >= localTracks.value.length) {
      currentLocalIndex.value = localTracks.value.length - 1;
    }
    savePlaylist();
  }

  function moveTrack(from: number, to: number): void {
    const len = localTracks.value.length;
    if (from === to || from < 0 || from >= len || to < 0 || to >= len) return;
    const [item] = localTracks.value.splice(from, 1);
    localTracks.value.splice(to, 0, item);

    const ci = currentLocalIndex.value;
    if (ci === from) {
      currentLocalIndex.value = to;
    } else if (from < ci && to >= ci) {
      currentLocalIndex.value = ci - 1;
    } else if (from > ci && to <= ci) {
      currentLocalIndex.value = ci + 1;
    }
    savePlaylist();
  }

  function buildPlayerTracks(): PlayerTrack[] {
    return localTracks.value.map((t) => ({
      chapterUrl: t.blobUrl,
      name: t.name,
      audioUrl: t.blobUrl,
    }));
  }

  function buildBookContext(): PlayerBookContext {
    return {
      fileName: "local-playlist",
      bookUrl: "local://playlist",
      name: "本地音乐",
      author: "本地文件",
    };
  }

  async function playLocalIndex(index: number): Promise<void> {
    if (localTracks.value.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, localTracks.value.length - 1));
    currentLocalIndex.value = safeIndex;
    await player.playList(buildBookContext(), buildPlayerTracks(), safeIndex);
    savePlaylist();
  }

  async function playNext(): Promise<void> {
    if (localTracks.value.length === 0) return;
    const mode = player.playMode;
    if (mode === "shuffle") {
      const pick = pickShuffleIndex();
      await playLocalIndex(pick);
      return;
    }
    let i = currentLocalIndex.value + 1;
    if (i >= localTracks.value.length) {
      i = mode === "list-loop" || mode === "repeat-one" ? 0 : currentLocalIndex.value;
    }
    await playLocalIndex(i);
  }

  async function playPrev(): Promise<void> {
    if (localTracks.value.length === 0) return;
    const mode = player.playMode;
    if (mode === "shuffle") {
      const pick = pickShuffleIndex();
      await playLocalIndex(pick);
      return;
    }
    let i = currentLocalIndex.value - 1;
    if (i < 0) {
      i = mode === "list-loop" ? localTracks.value.length - 1 : 0;
    }
    await playLocalIndex(i);
  }

  function shuffle(): void {
    if (localTracks.value.length <= 1) return;
    const arr = [...localTracks.value];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    localTracks.value = arr;
    currentLocalIndex.value = 0;
    savePlaylist();
  }

  function setLoopMode(mode: PlayMode): void {
    player.setPlayMode(mode);
  }

  function pickShuffleIndex(): number {
    if (localTracks.value.length <= 1) return currentLocalIndex.value;
    let pick = currentLocalIndex.value;
    while (pick === currentLocalIndex.value) {
      pick = Math.floor(Math.random() * localTracks.value.length);
    }
    return pick;
  }

  function clearAll(): void {
    for (const t of localTracks.value) {
      try {
        URL.revokeObjectURL(t.blobUrl);
      } catch {
        /* ignore */
      }
    }
    localTracks.value = [];
    currentLocalIndex.value = -1;
    player.clearSession();
    savePlaylist();
  }

  function isLocalTrack(url: string): boolean {
    return url.startsWith("blob:") || url.startsWith("file://");
  }

  async function extractDuration(blobUrl: string): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => {
        resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      });
      audio.addEventListener("error", () => resolve(0));
      audio.src = blobUrl;
    });
  }

  async function refreshDurations(): Promise<void> {
    for (const t of localTracks.value) {
      if (!t.duration || t.duration === 0) {
        t.duration = await extractDuration(t.blobUrl);
      }
    }
    savePlaylist();
  }

  return {
    playlist,
    currentIndex,
    currentTrack,
    hasLocalSession,
    addLocalFile,
    addLocalFiles,
    removeTrack,
    moveTrack,
    playLocalIndex,
    playNext,
    playPrev,
    shuffle,
    setLoopMode,
    clearAll,
    isLocalTrack,
    refreshDurations,
    loadPlaylist,
    savePlaylist,
  };
}