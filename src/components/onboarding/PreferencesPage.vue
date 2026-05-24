<script setup lang="ts">
import { ref } from 'vue'

const themes = [
  { id: 'auto', label: '跟随系统', icon: '🔄', colors: ['#f4f4f5', '#18181b'] },
  { id: 'light', label: '明亮', icon: '☀️', colors: ['#ffffff', '#f0f0f0'] },
  { id: 'dark', label: '暗黑', icon: '🌙', colors: ['#27272a', '#18181b'] },
  { id: 'sepia', label: '护眼', icon: '📜', colors: ['#f5e6c8', '#e8d5b0'] },
]

const fontSizes = [
  { id: 'small', label: '小', value: 'small' },
  { id: 'medium', label: '中', value: 'medium' },
  { id: 'large', label: '大', value: 'large' },
]

const pageModes = [
  { id: 'scroll', label: '滚动', icon: '📜' },
  { id: 'paged', label: '翻页', icon: '📖' },
  { id: 'cover', label: '覆盖', icon: '📔' },
]

const selectedTheme = ref('auto')
const selectedFontSize = ref('medium')
const selectedPageMode = ref('scroll')

defineEmits<{
  finish: [prefs: { theme: string; fontSize: string; pageMode: string }]
}>()
</script>

<template>
  <div class="preferences">
    <div class="preferences__header">
      <h2 class="preferences__title">个性化设置</h2>
    </div>

    <div class="preferences__sections">
      <section class="preferences__section">
        <h3 class="preferences__section-title">主题选择</h3>
        <div class="preferences__theme-grid">
          <button
            v-for="theme in themes"
            :key="theme.id"
            class="preferences__theme-card"
            :class="{ 'preferences__theme-card--active': selectedTheme === theme.id }"
            @click="selectedTheme = theme.id"
          >
            <div class="preferences__theme-preview" :style="{
              background: `linear-gradient(135deg, ${theme.colors[0]} 50%, ${theme.colors[1]} 50%)`
            }">
              <span class="preferences__theme-preview-icon">{{ theme.icon }}</span>
            </div>
            <span class="preferences__theme-label">{{ theme.label }}</span>
          </button>
        </div>
      </section>

      <section class="preferences__section">
        <h3 class="preferences__section-title">字体大小</h3>
        <div class="preferences__font-slider">
          <button
            v-for="size in fontSizes"
            :key="size.id"
            class="preferences__font-option"
            :class="{ 'preferences__font-option--active': selectedFontSize === size.id }"
            @click="selectedFontSize = size.id"
          >
            {{ size.label }}
          </button>
        </div>
      </section>

      <section class="preferences__section">
        <h3 class="preferences__section-title">翻页模式</h3>
        <div class="preferences__mode-grid">
          <button
            v-for="mode in pageModes"
            :key="mode.id"
            class="preferences__mode-card"
            :class="{ 'preferences__mode-card--active': selectedPageMode === mode.id }"
            @click="selectedPageMode = mode.id"
          >
            <span class="preferences__mode-icon">{{ mode.icon }}</span>
            <span class="preferences__mode-label">{{ mode.label }}</span>
          </button>
        </div>
      </section>
    </div>

    <div class="preferences__actions">
      <button
        class="preferences__btn"
        @click="$emit('finish', { theme: selectedTheme, fontSize: selectedFontSize, pageMode: selectedPageMode })"
      >
        完成
      </button>
    </div>
  </div>
</template>

<style scoped>
.preferences {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: var(--space-8) var(--space-6);
  background: var(--color-bg-page);
}

.preferences__header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.preferences__title {
  font-size: var(--fs-24);
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.preferences__sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  flex: 1;
  overflow-y: auto;
}

.preferences__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preferences__section-title {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preferences__theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.preferences__theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: none;
  border: var(--border-strong) solid transparent;
  border-radius: var(--radius-2);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}

.preferences__theme-card--active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.preferences__theme-preview {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-1);
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--border-thin) solid var(--color-border);
  overflow: hidden;
}

.preferences__theme-preview-icon {
  font-size: 1.25rem;
}

.preferences__theme-label {
  font-size: var(--fs-12);
  color: var(--color-text);
  font-weight: var(--fw-medium);
}

.preferences__font-slider {
  display: flex;
  gap: var(--space-2);
}

.preferences__font-option {
  flex: 1;
  min-height: var(--control-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: var(--border-thin) solid var(--color-border);
  border-radius: var(--radius-2);
  font-size: var(--fs-15);
  font-weight: var(--fw-medium);
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard);
}

.preferences__font-option:hover {
  background: var(--color-hover);
}

.preferences__font-option--active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.preferences__mode-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.preferences__mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-3);
  background: var(--color-surface);
  border: var(--border-thin) solid var(--color-border);
  border-radius: var(--radius-2);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}

.preferences__mode-card:hover {
  background: var(--color-hover);
}

.preferences__mode-card--active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.preferences__mode-icon {
  font-size: 1.75rem;
}

.preferences__mode-label {
  font-size: var(--fs-13);
  color: var(--color-text);
  font-weight: var(--fw-medium);
}

.preferences__actions {
  padding-top: var(--space-6);
}

.preferences__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  min-height: var(--control-lg);
  padding-inline: var(--space-5);
  border: none;
  border-radius: var(--radius-2);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
}

.preferences__btn:hover {
  background: var(--color-accent-hover);
}

.preferences__btn:active {
  transform: scale(0.97);
}
</style>