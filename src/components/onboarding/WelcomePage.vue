<script setup lang="ts">
defineEmits<{
  next: [];
}>()
</script>

<template>
  <div class="welcome">
    <div class="welcome__hero">
      <h1 class="welcome__logo">Legado</h1>
      <p class="welcome__tagline">自定义书源 · 纯净阅读</p>
    </div>

    <div class="welcome__features">
      <div class="welcome__feature">
        <span class="welcome__feature-icon">📖</span>
        <span class="welcome__feature-text">自定义书源，自由阅读</span>
      </div>
      <div class="welcome__feature">
        <span class="welcome__feature-icon">🎨</span>
        <span class="welcome__feature-text">高度自定义阅读界面</span>
      </div>
      <div class="welcome__feature">
        <span class="welcome__feature-icon">🔒</span>
        <span class="welcome__feature-text">无广告，完全开源</span>
      </div>
    </div>

    <div class="welcome__actions">
      <button class="welcome__btn" @click="$emit('next')">开始使用</button>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: var(--space-8) var(--space-6);
  background: linear-gradient(160deg, var(--color-bg-page) 0%, var(--color-accent-soft) 100%);
}

.welcome__hero {
  text-align: center;
  margin-bottom: var(--space-10);
}

.welcome__logo {
  font-size: 3.5rem;
  font-weight: var(--fw-bold);
  color: var(--color-accent);
  letter-spacing: 0.04em;
  margin-bottom: var(--space-3);
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--brand-400, #818cf8) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome__tagline {
  font-size: var(--fs-16);
  color: var(--color-text-soft);
  letter-spacing: 0.08em;
}

.welcome__features {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 320px;
  margin-bottom: var(--space-10);
}

.welcome__feature {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border-radius: var(--radius-2);
  box-shadow: var(--shadow-1);
}

.welcome__feature-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.welcome__feature-text {
  font-size: var(--fs-15);
  color: var(--color-text);
  font-weight: var(--fw-medium);
}

.welcome__actions {
  width: 100%;
  max-width: 320px;
}

.welcome__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
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

.welcome__btn:hover {
  background: var(--color-accent-hover);
}

.welcome__btn:active {
  transform: scale(0.97);
}
</style>