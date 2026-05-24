<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAchievementsStore } from '@/stores/achievements'

const store = useAchievementsStore()
const { toasts } = storeToRefs(store)

function onDismiss(id: string) {
  store.dismissToast(id)
}
</script>

<template>
  <Teleport to="body">
    <div class="achievement-toast-container" v-if="toasts.length > 0">
      <TransitionGroup name="achievement-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="achievement-toast"
          @click="onDismiss(toast.id)"
        >
          <span class="achievement-toast__icon">{{ toast.icon }}</span>
          <div class="achievement-toast__body">
            <span class="achievement-toast__name">{{ toast.name }}</span>
            <span class="achievement-toast__desc">{{ toast.description }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.achievement-toast-container {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}

.achievement-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--color-card-bg, #27272a);
  border: 1px solid var(--color-card-border, #3f3f46);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  cursor: pointer;
  min-width: 220px;
  max-width: 320px;
}

.achievement-toast__icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.achievement-toast__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.achievement-toast__name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text-base, #fafafa);
}

.achievement-toast__desc {
  font-size: 0.75rem;
  color: var(--color-text-muted, #a1a1aa);
}

.achievement-toast-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.achievement-toast-leave-active {
  transition: all 0.3s ease-in;
}

.achievement-toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.achievement-toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}
</style>