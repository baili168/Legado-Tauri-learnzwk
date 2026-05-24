<script setup lang="ts">
import {
  ChevronDown,
  GripVertical,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipForward,
  Trash2,
  X,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { isMobile } from "@/composables/useEnv";
import { useAudioPlaylist } from "@/composables/useAudioPlaylist";
import { useMusicPlayerStore, type PlayMode } from "@/stores";
import { getCoverImageUrl } from "@/utils/coverImage";

const player = useMusicPlayerStore();
const audioPlaylist = useAudioPlaylist();
const {
  hasSession,
  currentTrack,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  book,
  showFullPlayer,
  tracks,
  currentIndex,
  playMode,
} = storeToRefs(player);

const showQueue = ref(false);

const cover = computed(() => getCoverImageUrl(book.value?.coverUrl));
const isLocalSession = computed(() => book.value?.fileName === "local-playlist");
const isLocalType = computed(() => {
  if (!currentTrack.value?.audioUrl) return false;
  return currentTrack.value.audioUrl.startsWith("blob:") || currentTrack.value.audioUrl.startsWith("file://");
});

const progressPct = computed(() => {
  if (!Number.isFinite(duration.value) || duration.value <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (currentTime.value / duration.value) * 100));
});

const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  order: "顺序播放",
  "list-loop": "列表循环",
  "repeat-one": "单曲循环",
  shuffle: "随机播放",
};

const loopIcon = computed(() => {
  if (playMode.value === "shuffle") return Shuffle;
  if (playMode.value === "repeat-one") return Repeat1;
  return Repeat;
});

const isLoopActive = computed(() => playMode.value !== "order");

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return "00:00";
  const total = Math.floor(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function expand() {
  player.openFullPlayer();
}

function onTogglePlay(e: Event) {
  e.stopPropagation();
  void player.togglePlay();
}

function onNext(e: Event) {
  e.stopPropagation();
  if (isLocalSession.value) {
    void audioPlaylist.playNext();
  } else {
    void player.next();
  }
}

function onPrev(e: Event) {
  e.stopPropagation();
  if (isLocalSession.value) {
    void audioPlaylist.playPrev();
  } else {
    void player.prev();
  }
}

function onClose(e: Event) {
  e.stopPropagation();
  player.clearSession();
}

function toggleQueue(e: Event) {
  e.stopPropagation();
  showQueue.value = !showQueue.value;
}

function togglePlayMode(e: Event) {
  e.stopPropagation();
  const MODES: PlayMode[] = ["order", "list-loop", "repeat-one", "shuffle"];
  const current = MODES.indexOf(playMode.value);
  const next = MODES[(current + 1) % MODES.length];
  if (isLocalSession.value) {
    audioPlaylist.setLoopMode(next);
  } else {
    player.setPlayMode(next);
  }
}

function selectFromQueue(index: number) {
  showQueue.value = false;
  if (isLocalSession.value) {
    void audioPlaylist.playLocalIndex(index);
  } else {
    void player.playIndex(index);
  }
}

function removeFromQueue(e: Event, index: number) {
  e.stopPropagation();
  if (isLocalSession.value) {
    const wasCurrent = index === audioPlaylist.currentIndex.value;
    audioPlaylist.removeTrack(index);
    if (audioPlaylist.playlist.value.length === 0) {
      player.clearSession();
      return;
    }
    const rebuilt = audioPlaylist.playlist.value.map((t) => ({
      chapterUrl: t.blobUrl,
      name: t.name,
      audioUrl: t.blobUrl,
    }));
    player.tracks = rebuilt;
    const newIdx = Math.min(audioPlaylist.currentIndex.value, rebuilt.length - 1);
    player.currentIndex = newIdx;
    if (wasCurrent) {
      void player.playIndex(newIdx);
    }
  } else {
    const newTracks = [...tracks.value];
    newTracks.splice(index, 1);
    if (newTracks.length === 0) {
      player.clearSession();
      return;
    }
    const newCurrentIndex =
      index <= currentIndex.value && currentIndex.value > 0
        ? currentIndex.value - 1
        : Math.min(currentIndex.value, newTracks.length - 1);
    player.tracks = newTracks;
    player.currentIndex = newCurrentIndex;
  }
}

function onPlaylistItemClick(index: number) {
  selectFromQueue(index);
}

// ── 播放列表拖拽排序 ────────────────────────────────────────────────────
let dragFromIndex = -1;

function onDragStart(e: DragEvent, index: number) {
  dragFromIndex = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
}

function onDragEnd() {
  dragFromIndex = -1;
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault();
  if (dragFromIndex < 0) return;
  if (isLocalSession.value) {
    audioPlaylist.moveTrack(dragFromIndex, toIndex);
    const rebuilt = audioPlaylist.playlist.value.map((t) => ({
      chapterUrl: t.blobUrl,
      name: t.name,
      audioUrl: t.blobUrl,
    }));
    player.tracks = rebuilt;
    player.currentIndex = audioPlaylist.currentIndex.value;
  }
  dragFromIndex = -1;
}

// ── 播放列表滑动删除 ────────────────────────────────────────────────────
const swipeOffsets = ref<Record<number, number>>({});
let swipeStartX = 0;
let swipeCurrentIndex = -1;

function onPlaylistTouchStart(e: TouchEvent, index: number) {
  const t = e.touches[0];
  swipeStartX = t.clientX;
  swipeCurrentIndex = index;
}

function onPlaylistTouchMove(e: TouchEvent, index: number) {
  if (swipeCurrentIndex !== index) return;
  const t = e.touches[0];
  const dx = t.clientX - swipeStartX;
  if (dx < 0) {
    swipeOffsets.value = { ...swipeOffsets.value, [index]: Math.max(dx, -120) };
  } else {
    swipeOffsets.value = { ...swipeOffsets.value, [index]: 0 };
  }
}

function onPlaylistTouchEnd(e: TouchEvent, index: number) {
  if (swipeCurrentIndex !== index) return;
  const offset = swipeOffsets.value[index] || 0;
  if (offset < -60) {
    removeFromQueue(e, index);
  }
  swipeOffsets.value = { ...swipeOffsets.value, [index]: 0 };
  swipeCurrentIndex = -1;
}

// ── 移动端滑动手势 ────────────────────────────────────────────────────
let touchStartX = 0;
let touchStartY = 0;

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}

function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 40 && ady < 40) {
    return;
  }
  e.preventDefault();
  if (ady > adx) {
    if (dy < 0) {
      expand();
    }
  } else {
    if (isLocalSession.value) {
      if (dx < 0) {
        void audioPlaylist.playNext();
      } else {
        void audioPlaylist.playPrev();
      }
    } else {
      if (dx < 0) {
        void player.next();
      } else {
        void player.prev();
      }
    }
  }
}

function getDisplayTracks() {
  if (isLocalSession.value) {
    return audioPlaylist.playlist.value.map((t, i) => ({
      name: t.name,
      index: i,
      format: t.format,
    }));
  }
  return tracks.value.map((t, i) => ({ name: t.name, index: i }));
}
</script>

<template>
  <Teleport to="body">
    <Transition name="mini-player-fade">
      <div
        v-if="hasSession && !showFullPlayer"
        class="mini-player"
        :class="{ 'mini-player--mobile': isMobile }"
        role="button"
        tabindex="0"
        @click="expand"
        @keydown.enter="expand"
        @keydown.space.prevent="expand"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <div class="mini-player__progress" :style="{ width: progressPct + '%' }" />

        <div class="mini-player__cover">
          <img v-if="cover" :src="cover" :alt="book?.name ?? ''" loading="lazy" />
          <div v-else class="mini-player__cover-fallback">♪</div>
        </div>

        <div class="mini-player__meta">
          <div class="mini-player__title" :title="currentTrack?.name">
            {{ currentTrack?.name || "未播放" }}
          </div>
          <div class="mini-player__sub" :title="book?.name">
            <span v-if="isLocalType" class="mini-player__local-badge">本地</span>
            {{ isLocalSession ? "本地音乐" : book?.name }}
            <span v-if="book?.author && !isLocalSession"> · {{ book.author }}</span>
          </div>
        </div>

        <div class="mini-player__actions">
          <button
            type="button"
            class="mini-player__btn mini-player__btn--mode"
            :aria-label="PLAY_MODE_LABEL[playMode]"
            :title="PLAY_MODE_LABEL[playMode]"
            :class="{ 'mini-player__btn--active': isLoopActive }"
            @click="togglePlayMode"
          >
            <component :is="loopIcon" :size="15" />
          </button>
          <button
            v-if="isMobile"
            type="button"
            class="mini-player__btn"
            aria-label="上一首"
            @click="onPrev"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
          <button
            type="button"
            class="mini-player__btn mini-player__btn--play"
            :aria-label="isPlaying ? '暂停' : '播放'"
            :disabled="isLoading"
            @click="onTogglePlay"
          >
            <component :is="isPlaying ? Pause : Play" :size="20" />
          </button>
          <button type="button" class="mini-player__btn" aria-label="下一首" @click="onNext">
            <SkipForward :size="18" />
          </button>
          <button
            type="button"
            class="mini-player__btn"
            aria-label="播放列表"
            :class="{ 'mini-player__btn--active': showQueue }"
            @click="toggleQueue"
          >
            <ListMusic :size="16" />
          </button>
          <button
            type="button"
            class="mini-player__btn mini-player__btn--close"
            aria-label="关闭播放器"
            @click="onClose"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- 播放列表弹出层 -->
        <Transition name="queue-sheet-fade">
          <div v-if="showQueue" class="mini-player__queue-sheet" @click.stop>
            <div class="mini-queue__header">
              <span class="mini-queue__title">播放列表（{{ tracks.length }}）</span>
              <button
                type="button"
                class="mini-queue__close"
                aria-label="关闭"
                @click="showQueue = false"
              >
                <ChevronDown :size="16" />
              </button>
            </div>
            <ul class="mini-queue__list">
              <li
                v-for="(t, i) in getDisplayTracks()"
                :key="i"
                class="mini-queue__item"
                :class="{
                  'mini-queue__item--active': i === currentIndex,
                  'mini-queue__item--dragging': dragFromIndex === i,
                }"
                :style="{
                  transform: `translateX(${swipeOffsets[i] || 0}px)`,
                  transition: swipeCurrentIndex === i ? 'none' : 'transform 0.2s ease',
                }"
                draggable="true"
                @click="onPlaylistItemClick(i)"
                @dragstart="onDragStart($event, i)"
                @dragover="onDragOver($event, i)"
                @dragend="onDragEnd"
                @drop="onDrop($event, i)"
                @touchstart.passive="onPlaylistTouchStart($event, i)"
                @touchmove="onPlaylistTouchMove($event, i)"
                @touchend="onPlaylistTouchEnd($event, i)"
              >
                <span class="mini-queue__grip" @click.stop>
                  <GripVertical :size="14" />
                </span>
                <span class="mini-queue__index">{{ i + 1 }}</span>
                <span class="mini-queue__name">{{ t.name }}</span>
                <span v-if="t.format" class="mini-queue__format">{{ t.format.toUpperCase() }}</span>
                <Play
                  v-if="i === currentIndex && isPlaying"
                  class="mini-queue__playing"
                  :size="13"
                />
                <button
                  type="button"
                  class="mini-queue__remove"
                  aria-label="移除"
                  @click.stop="removeFromQueue($event, i)"
                >
                  <Trash2 :size="13" />
                </button>
              </li>
            </ul>
            <div v-if="getDisplayTracks().length === 0" class="mini-queue__empty">
              播放列表为空
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── 基础 ────────────────────────────────────────────────────────────── */
.mini-player {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 1900;

  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px 0 6px;
  height: 62px;

  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: var(--mini-player-bg);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: var(--mini-player-shadow);

  cursor: pointer;
  overflow: visible;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform var(--dur-fast, 0.12s) ease,
    box-shadow var(--dur-fast, 0.12s) ease;
}

/* 浅色主题 */
:root,
[data-theme="light"] {
  --mini-player-bg: rgba(255, 255, 255, 0.88);
  --mini-player-shadow: 0 4px 24px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);
  --mini-player-btn-hover: rgba(0, 0, 0, 0.06);
  --mini-player-play-bg: var(--color-accent, #3452e6);
  --mini-player-play-color: #fff;
  --mini-queue-bg: rgba(255, 255, 255, 0.95);
  --mini-queue-hover: rgba(0, 0, 0, 0.04);
  --mini-queue-active: var(--color-accent, #3452e6);
  --mini-queue-sep: rgba(0, 0, 0, 0.08);
}

/* 深色主题 */
[data-theme="dark"] {
  --mini-player-bg: rgba(30, 32, 40, 0.9);
  --mini-player-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);
  --mini-player-btn-hover: rgba(255, 255, 255, 0.1);
  --mini-player-play-bg: var(--color-accent, #8fafff);
  --mini-player-play-color: #111;
  --mini-queue-bg: rgba(24, 26, 32, 0.96);
  --mini-queue-hover: rgba(255, 255, 255, 0.06);
  --mini-queue-active: #6ee7b7;
  --mini-queue-sep: rgba(255, 255, 255, 0.08);
}

/* 系统深色（auto/未设置主题） */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]),
  [data-theme="auto"] {
    --mini-player-bg: rgba(30, 32, 40, 0.9);
    --mini-player-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);
    --mini-player-btn-hover: rgba(255, 255, 255, 0.1);
    --mini-player-play-bg: var(--color-accent, #8fafff);
    --mini-player-play-color: #111;
    --mini-queue-bg: rgba(24, 26, 32, 0.96);
    --mini-queue-hover: rgba(255, 255, 255, 0.06);
    --mini-queue-active: #6ee7b7;
    --mini-queue-sep: rgba(255, 255, 255, 0.08);
  }
}

/* 桌面端悬停 */
@media (hover: hover) {
  .mini-player:hover {
    transform: translateY(-2px);
    box-shadow:
      var(--mini-player-shadow),
      0 8px 32px rgba(0, 0, 0, 0.12);
  }
}

/* ── 移动端：浮于 BottomNav 之上 ────────────────────────────────────── */
.mini-player--mobile {
  left: 8px;
  right: 8px;
  bottom: calc(var(--bottom-bar-height, 2.5rem) + var(--safe-bottom, 0px) + 8px);
  height: 58px;
  border-radius: 12px;
}

/* ── 进度条 ──────────────────────────────────────────────────────────── */
.mini-player__progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--color-accent, #3452e6);
  transition: width 0.2s linear;
}

/* ── 封面 ────────────────────────────────────────────────────────────── */
.mini-player__cover {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mini-player__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-player__cover-fallback {
  font-size: 20px;
  color: var(--color-text-muted);
}

/* ── 文字 ────────────────────────────────────────────────────────────── */
.mini-player__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mini-player__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.mini-player__sub {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mini-player__local-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 0 4px;
  height: 15px;
  line-height: 15px;
  border-radius: 3px;
  background: var(--color-accent, #3452e6);
  color: #fff;
  flex-shrink: 0;
}

/* ── 操作区 ──────────────────────────────────────────────────────────── */
.mini-player__actions {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.mini-player__btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--dur-fast, 0.12s) ease;
  -webkit-tap-highlight-color: transparent;
}

.mini-player__btn:hover:not(:disabled) {
  background: var(--mini-player-btn-hover);
}

.mini-player__btn:active:not(:disabled) {
  transform: scale(0.9);
}

.mini-player__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mini-player__btn--active {
  color: var(--color-accent, #3452e6);
}

/* 主播放按钮：填充主题色 */
.mini-player__btn--play {
  width: 38px;
  height: 38px;
  background: var(--mini-player-play-bg);
  color: var(--mini-player-play-color);
}

.mini-player__btn--play:hover:not(:disabled) {
  filter: brightness(1.1);
  background: var(--mini-player-play-bg);
}

.mini-player__btn--mode {
  width: 30px;
  height: 30px;
  color: var(--color-text-muted);
}

.mini-player__btn--mode.mini-player__btn--active {
  color: var(--color-accent, #3452e6);
}

.mini-player__btn--close {
  width: 28px;
  height: 28px;
  color: var(--color-text-muted);
}

/* ── 播放列表弹出层 ──────────────────────────────────────────────────── */
.mini-player__queue-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 8px);
  max-height: 320px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--mini-queue-bg);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
}

.mini-queue__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--mini-queue-sep);
  flex-shrink: 0;
}

.mini-queue__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.mini-queue__close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.mini-queue__close:hover {
  background: var(--mini-player-btn-hover);
}

.mini-queue__list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
}

.mini-queue__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text);
  transition: background 0.12s ease;
}

.mini-queue__item:hover {
  background: var(--mini-queue-hover);
}

.mini-queue__item--active {
  color: var(--mini-queue-active);
  font-weight: 500;
}

.mini-queue__item--dragging {
  opacity: 0.4;
}

.mini-queue__grip {
  flex-shrink: 0;
  cursor: grab;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: 2px;
}

.mini-queue__grip:active {
  cursor: grabbing;
}

.mini-queue__index {
  width: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  font-size: 10px;
  flex-shrink: 0;
}

.mini-queue__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-queue__format {
  font-size: 9px;
  color: var(--color-text-muted);
  padding: 0 4px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  flex-shrink: 0;
}

.mini-queue__playing {
  flex: 0 0 13px;
  color: var(--mini-queue-active);
}

.mini-queue__remove {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}

.mini-queue__item:hover .mini-queue__remove {
  opacity: 1;
}

.mini-queue__remove:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.mini-queue__empty {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ── 入场/离场动画 ────────────────────────────────────────────────────── */
.mini-player-fade-enter-active,
.mini-player-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s ease;
}

.mini-player-fade-enter-from,
.mini-player-fade-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.queue-sheet-fade-enter-active,
.queue-sheet-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.2s ease;
}

.queue-sheet-fade-enter-from,
.queue-sheet-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>