<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Fingerprint, Delete } from "lucide-vue-next";
import { useAppLock } from "@/composables/useAppLock";

const emit = defineEmits<{
  unlock: [];
}>();

const {
  unlockApp,
  authenticateBiometric,
  checkBiometricSupport,
  biometricEnabled,
} = useAppLock();

const pin = ref("");
const maxDigits = 6;
const error = ref(false);
const shaking = ref(false);
const biometricSupported = ref(false);
const biometricLoading = ref(false);

const dots = computed(() => {
  const arr: boolean[] = [];
  for (let i = 0; i < maxDigits; i++) {
    arr.push(i < pin.value.length);
  }
  return arr;
});

const numpadKeys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["bio", "0", "delete"],
];

function handleKeyPress(key: string) {
  if (key === "delete") {
    if (pin.value.length > 0) {
      pin.value = pin.value.slice(0, -1);
    }
    return;
  }
  if (key === "bio") {
    handleBiometric();
    return;
  }
  if (pin.value.length < maxDigits) {
    pin.value += key;
    if (pin.value.length >= 4) {
      attemptUnlock();
    }
  }
}

async function attemptUnlock() {
  if (pin.value.length < 4) return;

  const success = await unlockApp(pin.value);
  if (success) {
    emit("unlock");
  } else {
    error.value = true;
    shaking.value = true;
    pin.value = "";
    setTimeout(() => {
      shaking.value = false;
    }, 500);
  }
}

async function handleBiometric() {
  biometricLoading.value = true;
  try {
    const success = await authenticateBiometric();
    if (success) {
      emit("unlock");
    }
  } finally {
    biometricLoading.value = false;
  }
}

function showBioKey(): boolean {
  return biometricEnabled.value && biometricSupported.value;
}

onMounted(async () => {
  biometricSupported.value = await checkBiometricSupport();
});
</script>

<template>
  <div class="lock-screen">
    <div class="lock-screen__backdrop" />

    <div class="lock-screen__content">
      <div class="lock-screen__brand">
        <div class="lock-screen__logo">L</div>
        <h1 class="lock-screen__name">Legado</h1>
      </div>

      <p class="lock-screen__prompt">输入密码解锁</p>

      <div class="lock-screen__dots" :class="{ 'lock-screen__dots--shake': shaking }">
        <span
          v-for="(filled, i) in dots"
          :key="i"
          class="lock-screen__dot"
          :class="{
            'lock-screen__dot--filled': filled,
            'lock-screen__dot--error': error && i === 0,
          }"
        />
      </div>

      <p v-if="error" class="lock-screen__error-text">密码错误，请重试</p>

      <div class="lock-screen__numpad">
        <div v-for="(row, ri) in numpadKeys" :key="ri" class="lock-screen__numpad-row">
          <template v-for="key in row" :key="key">
            <div v-if="key === 'bio' && showBioKey()" class="lock-screen__numpad-cell" />
            <button
              v-if="key === 'delete'"
              class="lock-screen__numpad-key lock-screen__numpad-key--delete"
              @click="handleKeyPress('delete')"
            >
              <Delete :size="24" />
            </button>
            <button
              v-else-if="key !== 'bio'"
              class="lock-screen__numpad-key"
              @click="handleKeyPress(key)"
            >
              {{ key }}
            </button>
          </template>
        </div>
      </div>

      <button
        v-if="showBioKey()"
        class="lock-screen__bio-btn"
        :disabled="biometricLoading"
        @click="handleBiometric"
      >
        <Fingerprint v-if="!biometricLoading" :size="20" />
        <span v-else class="lock-screen__bio-spinner" />
        <span>使用指纹</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-screen__backdrop {
  position: absolute;
  inset: 0;
  background: var(--color-bg-page, var(--color-bg));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.lock-screen__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-6);
  width: 100%;
  max-width: 360px;
  user-select: none;
  -webkit-user-select: none;
}

.lock-screen__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.lock-screen__logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-28);
  font-weight: var(--fw-bold);
  box-shadow: 0 8px 24px rgba(68, 103, 255, 0.3);
}

.lock-screen__name {
  font-size: var(--fs-20);
  font-weight: var(--fw-bold);
  color: var(--color-text);
  margin: 0;
}

.lock-screen__prompt {
  font-size: var(--fs-14);
  color: var(--color-text-soft);
  margin: 0;
}

.lock-screen__dots {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  justify-content: center;
  height: 40px;
}

.lock-screen__dots--shake {
  animation: lock-shake 0.4s var(--ease-standard);
}

@keyframes lock-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  50%,
  90% {
    transform: translateX(-8px);
  }
  30%,
  70% {
    transform: translateX(8px);
  }
}

.lock-screen__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: transparent;
  transition:
    background var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
}

.lock-screen__dot--filled {
  background: var(--color-accent);
  border-color: var(--color-accent);
  transform: scale(1.1);
}

.lock-screen__dot--error {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.lock-screen__error-text {
  font-size: var(--fs-13);
  color: var(--color-danger);
  margin: 0;
  min-height: 0;
}

.lock-screen__numpad {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  max-width: 280px;
}

.lock-screen__numpad-row {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
}

.lock-screen__numpad-key {
  width: 64px;
  height: 56px;
  border: none;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--color-text);
  font-size: var(--fs-24);
  font-weight: var(--fw-medium);
  font-family: var(--font-ui);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-fast) var(--ease-standard);
}

.lock-screen__numpad-key:hover {
  background: var(--color-hover);
}

.lock-screen__numpad-key:active {
  background: var(--color-active);
}

.lock-screen__numpad-key--delete {
  color: var(--color-text-soft);
}

.lock-screen__numpad-cell {
  width: 64px;
  height: 56px;
}

.lock-screen__bio-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-accent);
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  font-family: var(--font-ui);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
}

.lock-screen__bio-btn:hover {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}

.lock-screen__bio-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.lock-screen__bio-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-accent-soft);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: bio-spin 0.7s linear infinite;
}

@keyframes bio-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>