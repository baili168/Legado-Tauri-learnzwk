<script setup lang="ts">
import { computed, ref } from 'vue';
import { SkipBack, Loader2, Pause, Play, SkipForward, X, Mic, Server } from 'lucide-vue-next';
import { NSlider, NSelect, NPopover } from 'naive-ui';
import { useTts } from '@/composables/useTts';
import { TTS_ENGINE_OPTIONS, TTS_RATE_PRESETS } from '@/features/reader/settings/readerSettingsOptions';
import type { TTSEngine } from '@/composables/useTts';

const props = defineProps<{
  visible: boolean;
  progressText?: string;
  availableVoices?: { label: string; value: string }[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const tts = useTts();

const localRate = ref(tts.playbackRate.value);

const currentEngineLabel = computed(() => {
  const option = TTS_ENGINE_OPTIONS.find(o => o.value === tts.activeEngine.value);
  return option?.label ?? '未知';
});

const speedMarks = computed(() => {
  const marks: Record<number, string> = {};
  TTS_RATE_PRESETS.forEach(p => {
    marks[p.value] = p.label;
  });
  return marks;
});

function handleRateChange(value: number) {
  localRate.value = value;
  tts.setPlaybackRate(value);
}

function handleEngineSwitch() {
  const engines: TTSEngine[] = ['web-speech', 'piper'];
  const currentIdx = engines.indexOf(tts.activeEngine.value);
  const nextEngine = engines[(currentIdx + 1) % engines.length];
  tts.setEngine(nextEngine);
}

function handleVoiceChange(value: string) {
  tts.setPiperVoice(value);
}

function handleClose() {
  tts.stop();
  emit('close');
}

function togglePlayPause() {
  if (tts.isPlaying.value) {
    tts.pause();
  } else {
    tts.play();
  }
}
</script>

<template>
  <Transition name="tts-bar">
    <div v-if="visible" class="tts-control-bar" role="toolbar" aria-label="朗读控制">
      <div class="tts-control-bar__notice">朗读功能仅供测试，很多人反馈有问题</div>

      <span class="tts-control-bar__progress">
        {{ progressText ?? '—' }}
      </span>

      <button class="tts-control-bar__btn" title="上一段" @click="tts.prevSegment()">
        <SkipBack :size="18" />
      </button>

      <button
        class="tts-control-bar__btn tts-control-bar__btn--play"
        :title="tts.isPlaying.value ? '暂停' : '播放'"
        @click="togglePlayPause"
      >
        <Loader2 v-if="tts.isLoading.value" class="tts-control-bar__spin" :size="20" />
        <Pause v-else-if="tts.isPlaying.value" :size="20" />
        <Play v-else :size="20" />
      </button>

      <button class="tts-control-bar__btn" title="下一段" @click="tts.nextSegment()">
        <SkipForward :size="18" />
      </button>

      <div class="tts-control-bar__speed">
        <span class="tts-control-bar__speed-label">{{ localRate.toFixed(1) }}×</span>
        <NSlider
          v-model:value="localRate"
          :min="0.5"
          :max="3.0"
          :step="0.1"
          :marks="speedMarks"
          :format-tooltip="(v: number) => `${v.toFixed(1)}×`"
          @update:value="handleRateChange"
        />
      </div>

      <NPopover
        trigger="click"
        placement="top"
        :disabled="!availableVoices?.length"
      >
        <template #trigger>
          <button
            class="tts-control-bar__btn tts-control-bar__btn--engine"
            :class="{ 'tts-control-bar__btn--engine-active': tts.activeEngine.value === 'piper' }"
            :title="currentEngineLabel"
          >
            <Mic v-if="tts.activeEngine.value === 'web-speech'" :size="16" />
            <Server v-else :size="16" />
          </button>
        </template>
        <div class="tts-control-bar__engine-menu">
          <div class="tts-control-bar__engine-hint">
            当前引擎: {{ currentEngineLabel }}
          </div>
          <div v-if="tts.activeEngine.value === 'piper' && !tts.piperAvailable.value" class="tts-control-bar__piper-warning">
            Piper 未安装或模型不可用
          </div>
          <div v-if="availableVoices?.length" class="tts-control-bar__voice-select">
            <label class="tts-control-bar__voice-label">音色</label>
            <NSelect
              :value="tts.piperVoice.value"
              :options="availableVoices"
              placeholder="选择音色"
              @update:value="handleVoiceChange"
            />
          </div>
        </div>
      </NPopover>

      <button
        class="tts-control-bar__btn tts-control-bar__btn--close"
        title="关闭朗读"
        @click="handleClose"
      >
        <X :size="16" :stroke-width="2.5" />
      </button>

      <div v-if="tts.error.value" class="tts-control-bar__error">
        {{ tts.error.value }}
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tts-control-bar {
  position: fixed;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 32px;
  background: rgba(30, 30, 35, 0.92);
  backdrop-filter: blur(16px);
  color: #e8e8e8;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  max-width: calc(100vw - 32px);
  overflow: visible;
}

.tts-control-bar__progress {
  font-size: 0.75rem;
  opacity: 0.7;
  min-width: 3.5em;
  text-align: center;
}

.tts-control-bar__notice {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 48px);
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(30, 30, 35, 0.92);
  color: #ffd98a;
  font-size: 0.6875rem;
  line-height: 1.4;
  text-align: center;
  white-space: nowrap;
  overflow-wrap: anywhere;
  pointer-events: none;
}

.tts-control-bar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition:
    background 0.15s,
    opacity 0.15s;
  flex-shrink: 0;
}

.tts-control-bar__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.tts-control-bar__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tts-control-bar__btn--play {
  width: 40px;
  height: 40px;
  background: rgba(99, 226, 183, 0.18);
  color: #63e2b7;
}
.tts-control-bar__btn--play:hover:not(:disabled) {
  background: rgba(99, 226, 183, 0.28);
}

.tts-control-bar__btn--engine {
  opacity: 0.6;
}

.tts-control-bar__btn--engine-active {
  opacity: 1;
  color: #63e2b7;
}

.tts-control-bar__btn--close {
  opacity: 0.6;
  margin-left: 4px;
}
.tts-control-bar__btn--close:hover {
  opacity: 1;
}

.tts-control-bar__speed {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120px;
  margin: 0 4px;
}

.tts-control-bar__speed-label {
  font-size: 0.6875rem;
  opacity: 0.8;
  margin-bottom: 2px;
  font-variant-numeric: tabular-nums;
}

.tts-control-bar__spin {
  animation: tts-spin 0.9s linear infinite;
}
@keyframes tts-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.tts-control-bar__error {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(220, 60, 60, 0.9);
  color: #fff;
  font-size: 0.75rem;
  padding: 4px 12px;
  border-radius: 8px;
  white-space: nowrap;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.tts-control-bar__engine-menu {
  padding: 8px;
  min-width: 160px;
}

.tts-control-bar__engine-hint {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-bottom: 8px;
}

.tts-control-bar__piper-warning {
  font-size: 0.75rem;
  color: #ffa500;
  margin-bottom: 8px;
}

.tts-control-bar__voice-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tts-control-bar__voice-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.tts-bar-enter-active,
.tts-bar-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.tts-bar-enter-from,
.tts-bar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
