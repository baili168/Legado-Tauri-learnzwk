<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { NButton, NColorPicker, NInput, NModal } from 'naive-ui'
import { useOverlayBackstack } from '@/composables/useOverlayBackstack'

interface Rgb {
  r: number
  g: number
  b: number
}

interface Hsl {
  h: number
  s: number
  l: number
}

const props = withDefaults(
  defineProps<{
    show: boolean
    initialColors?: Record<string, string>
  }>(),
  {
    initialColors: undefined,
  },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: [payload: { name: string; colors: Record<string, string> }]
}>()

useOverlayBackstack(
  () => props.show,
  () => emit('update:show', false),
)

const COLOR_GROUPS = [
  { name: 'Primary', keys: ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer'] },
  { name: 'Secondary', keys: ['secondary', 'onSecondary', 'secondaryContainer'] },
  { name: 'Tertiary', keys: ['tertiary', 'onTertiary'] },
  { name: 'Error', keys: ['error', 'onError'] },
  { name: 'Surface', keys: ['surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant'] },
  { name: 'Background', keys: ['background', 'onBackground'] },
  { name: 'Outline', keys: ['outline', 'outlineVariant'] },
  { name: 'Inverse', keys: ['inverseSurface', 'inverseOnSurface', 'inversePrimary'] },
  { name: 'Shadow', keys: ['shadow', 'scrim'] },
]

const ALL_COLOR_KEYS = COLOR_GROUPS.flatMap((g) => g.keys)

const M3_LIGHT_COLORS: Record<string, string> = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  error: '#B3261E',
  onError: '#FFFFFF',
  surface: '#FEF7FF',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
  background: '#FEF7FF',
  onBackground: '#1C1B1F',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#D0BCFF',
  shadow: '#000000',
  scrim: '#000000',
}

const M3_DARK_COLORS: Record<string, string> = {
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  tertiary: '#EFB8C8',
  onTertiary: '#492532',
  error: '#F2B8B5',
  onError: '#601410',
  surface: '#1C1B1F',
  onSurface: '#E6E1E5',
  surfaceVariant: '#49454F',
  onSurfaceVariant: '#CAC4D0',
  background: '#1C1B1F',
  onBackground: '#E6E1E5',
  outline: '#938F99',
  outlineVariant: '#49454F',
  inverseSurface: '#E6E1E5',
  inverseOnSurface: '#1C1B1F',
  inversePrimary: '#6750A4',
  shadow: '#000000',
  scrim: '#000000',
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  switch (max) {
    case nr:
      h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6
      break
    case ng:
      h = ((nb - nr) / d + 2) / 6
      break
    case nb:
      h = ((nr - ng) / d + 4) / 6
      break
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
  const ns = s / 100
  const nl = l / 100
  const a = ns * Math.min(nl, 1 - nl)

  const f = (n: number): string => {
    const k = (n + h / 30) % 12
    const color = nl - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }

  return `#${f(0)}${f(8)}${f(4)}`
}

function clampTone(tone: number): number {
  return Math.max(0, Math.min(100, tone))
}

function createTonalPalette(seedHex: string): (tone: number) => string {
  const h = rgbToHsl(hexToRgb(seedHex).r, hexToRgb(seedHex).g, hexToRgb(seedHex).b).h
  const s = rgbToHsl(hexToRgb(seedHex).r, hexToRgb(seedHex).g, hexToRgb(seedHex).b).s

  return (tone: number): string => {
    const t = clampTone(tone)
    const chromaPeak = Math.sin((t / 100) * Math.PI)
    const adjustedS = s * (0.3 + 0.7 * chromaPeak)
    return hslToHex(h, adjustedS, t)
  }
}

function generateIndigoPalette(): Record<string, string> {
  const seedHex = '#4467FF'
  const palette = createTonalPalette(seedHex)

  const tones: Record<string, number> = {
    primary: 40,
    onPrimary: 100,
    primaryContainer: 90,
    onPrimaryContainer: 10,
    secondary: 40,
    onSecondary: 100,
    secondaryContainer: 95,
    tertiary: 40,
    onTertiary: 100,
    surface: 98,
    onSurface: 10,
    surfaceVariant: 90,
    onSurfaceVariant: 30,
    error: 40,
    onError: 100,
    outline: 50,
    outlineVariant: 80,
    background: 98,
    onBackground: 10,
    inverseSurface: 20,
    inverseOnSurface: 95,
    inversePrimary: 80,
    shadow: '#000000' as unknown as number,
    scrim: '#000000' as unknown as number,
  }

  const result: Record<string, string> = {}
  for (const key of ALL_COLOR_KEYS) {
    if (key === 'shadow' || key === 'scrim') {
      result[key] = '#000000'
    } else {
      result[key] = palette(tones[key])
    }
  }

  return result
}

const DEFAULT_INDIGO_PALETTE = generateIndigoPalette()

const themeName = ref('我的主题')
const colors = reactive<Record<string, string>>({ ...DEFAULT_INDIGO_PALETTE })

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      themeName.value = '我的主题'
      if (props.initialColors && Object.keys(props.initialColors).length > 0) {
        for (const key of ALL_COLOR_KEYS) {
          colors[key] = props.initialColors[key] ?? DEFAULT_INDIGO_PALETTE[key]
        }
      } else {
        Object.assign(colors, DEFAULT_INDIGO_PALETTE)
      }
    }
  },
)

function applyCssVariables(palette: Record<string, string>) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(palette)) {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(`--md-sys-color-${cssKey}`, value)
  }
}

watch(
  () => ({ ...colors }),
  (newColors) => {
    applyCssVariables(newColors)
  },
)

function fillLightDefault() {
  Object.assign(colors, M3_LIGHT_COLORS)
}

function fillDarkDefault() {
  Object.assign(colors, M3_DARK_COLORS)
}

function handleSave() {
  emit('save', { name: themeName.value, colors: { ...colors } })
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="主题编辑器"
    class="theme-editor-modal"
    :style="{ width: '640px', maxWidth: '95vw', maxHeight: '85vh' }"
    :mask-closable="true"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="theme-editor">
      <div class="theme-editor__name">
        <n-input v-model:value="themeName" placeholder="主题名称" size="small" />
      </div>

      <div class="theme-editor__presets">
        <n-button size="tiny" quaternary @click="fillLightDefault">填充亮色默认</n-button>
        <n-button size="tiny" quaternary @click="fillDarkDefault">填充暗色默认</n-button>
      </div>

      <div class="theme-editor__groups">
        <div v-for="group in COLOR_GROUPS" :key="group.name" class="theme-editor__group">
          <h3 class="theme-editor__group-title">{{ group.name }}</h3>
          <div class="theme-editor__grid">
            <div v-for="key in group.keys" :key="key" class="theme-editor__color-item">
              <span class="theme-editor__color-label">{{ key }}</span>
              <div class="theme-editor__color-control">
                <div
                  class="theme-editor__color-swatch"
                  :style="{ backgroundColor: colors[key] }"
                />
                <n-color-picker
                  :value="colors[key]"
                  :modes="['hex']"
                  size="small"
                  :swatches="[]"
                  @update:value="(v: string) => (colors[key] = v)"
                />
                <span class="theme-editor__color-hex">{{ colors[key] }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="theme-editor__footer">
        <n-button size="small" @click="emit('update:show', false)">取消</n-button>
        <n-button size="small" type="primary" @click="handleSave">保存</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.theme-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.theme-editor__name {
  max-width: 280px;
}

.theme-editor__presets {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.theme-editor__groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 52vh;
  overflow-y: auto;
  padding-right: 4px;
}

.theme-editor__group-title {
  font-size: var(--fs-14);
  font-weight: var(--fw-bold);
  color: var(--color-text);
  margin: 0 0 var(--space-1);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}

.theme-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.theme-editor__color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-1);
  background: var(--color-surface-elevated);
}

.theme-editor__color-label {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  font-family: var(--font-mono, monospace);
}

.theme-editor__color-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-editor__color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.theme-editor__color-hex {
  font-size: var(--fs-12);
  font-family: var(--font-mono, monospace);
  color: var(--color-text-soft);
  min-width: 64px;
}

.theme-editor__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 520px) {
  .theme-editor__grid {
    grid-template-columns: 1fr;
  }
}
</style>