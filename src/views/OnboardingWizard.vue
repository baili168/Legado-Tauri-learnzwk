<script setup lang="ts">
import { ref, computed } from 'vue'
import WelcomePage from '@/components/onboarding/WelcomePage.vue'
import SourceImportPage, { type SourceOption } from '@/components/onboarding/SourceImportPage.vue'
import PreferencesPage from '@/components/onboarding/PreferencesPage.vue'
import { useAppConfigStore } from '@/stores'
import { usePreferencesStore } from '@/stores/preferences'

const emit = defineEmits<{
  complete: []
}>()

const STORAGE_KEY = 'onboarding_complete'

const currentStep = ref(0)
const direction = ref<'forward' | 'backward'>('forward')

const defaultSources: SourceOption[] = [
  {
    name: 'legado-开源阅读',
    url: 'https://raw.githubusercontent.com/Celeter/legado-source/main/booksource.json',
    description: '综合书源集合，涵盖主流小说网站'
  },
  {
    name: 'Namo-书源合集',
    url: 'https://raw.githubusercontent.com/namofree/source/main/booksource.json',
    description: '高品质精选书源，定期维护更新'
  },
  {
    name: 'Xiaota-轻量书源',
    url: 'https://raw.githubusercontent.com/XiaotaK/legado-source/main/booksource.json',
    description: '轻量高效的书源，降低请求延迟'
  },
  {
    name: 'Zcload-漫画书源',
    url: 'https://raw.githubusercontent.com/zcload/source/main/booksource.json',
    description: '专注于漫画资源的书源集合'
  },
  {
    name: 'CandyMuj-精选书源',
    url: 'https://raw.githubusercontent.com/CandyMuj/source/main/booksource.json',
    description: '多类型书源，包含小说、听书等'
  },
]

const transitioning = ref(false)

function goToStep(step: number) {
  if (transitioning.value || step === currentStep.value) return
  if (step < 0 || step > 2) return

  direction.value = step > currentStep.value ? 'forward' : 'backward'
  transitioning.value = true
  currentStep.value = step

  setTimeout(() => {
    transitioning.value = false
  }, 300)
}

function goNext() {
  goToStep(currentStep.value + 1)
}

function handleFinish(prefs: { theme: string; fontSize: string; pageMode: string }) {
  const appConfigStore = useAppConfigStore()
  const preferencesStore = usePreferencesStore()

  if (prefs.theme && prefs.theme !== 'sepia') {
    appConfigStore.setConfig('ui_theme', prefs.theme).catch(() => {})
  }

  if (prefs.fontSize) {
    const root = document.documentElement
    root.setAttribute('data-font-scale', prefs.fontSize)
  }

  if (prefs.pageMode) {
    preferencesStore.patchReader({ pageMode: prefs.pageMode }).catch(() => {})
  }

  localStorage.setItem(STORAGE_KEY, 'true')
  emit('complete')
}

function handleSkipSourceImport() {
  goNext()
}
</script>

<template>
  <div class="wizard">
    <div class="wizard__dots">
      <button
        v-for="i in 3"
        :key="i"
        class="wizard__dot"
        :class="{
          'wizard__dot--active': currentStep === i - 1,
          'wizard__dot--done': currentStep > i - 1,
        }"
        :aria-label="`第 ${i} 步`"
        @click="goToStep(i - 1)"
      />
    </div>

    <div class="wizard__content">
      <Transition :name="direction === 'forward' ? 'slide-left' : 'slide-right'">
        <div v-if="currentStep === 0" key="welcome" class="wizard__page">
          <WelcomePage @next="goNext" />
        </div>
        <div v-else-if="currentStep === 1" key="source" class="wizard__page">
          <SourceImportPage
            :sources="defaultSources"
            @next="goNext"
            @skip="handleSkipSourceImport"
          />
        </div>
        <div v-else-if="currentStep === 2" key="preferences" class="wizard__page">
          <PreferencesPage @finish="handleFinish" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.wizard {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: var(--color-bg-page);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wizard__dots {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  padding-top: max(var(--space-4), env(safe-area-inset-top, 0px));
  flex-shrink: 0;
  z-index: 1;
}

.wizard__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: none;
  background: var(--color-border);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
}

.wizard__dot--active {
  background: var(--color-accent);
  transform: scale(1.3);
}

.wizard__dot--done {
  background: var(--color-accent);
  opacity: 0.5;
}

.wizard__content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.wizard__page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s var(--ease-standard);
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>