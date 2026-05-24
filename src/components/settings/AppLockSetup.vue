<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import SettingSection from "./SettingSection.vue";
import SettingItem from "./SettingItem.vue";
import { useAppLock } from "@/composables/useAppLock";

const {
  lockEnabled,
  biometricEnabled,
  isPinSet,
  setPin,
  verifyPin,
  clearPin,
  setEnabled,
  setBiometric,
  checkBiometricSupport,
} = useAppLock();

const pinEntered = ref("");
const pinConfirm = ref("");
const currentPinInput = ref("");
const setupStep = ref<"idle" | "setup" | "change">("idle");
const errorMessage = ref("");
const successMessage = ref("");
const biometricAvailable = ref(false);

const pinEnteredValid = computed(() => pinEntered.value.length >= 4 && pinEntered.value.length <= 6);
const pinConfirmValid = computed(() => pinConfirm.value.length >= 4 && pinConfirm.value.length <= 6);
const pinsMatch = computed(() => pinEntered.value === pinConfirm.value);

function handleToggleLock(enabled: boolean) {
  if (enabled) {
    if (!isPinSet()) {
      setupStep.value = "setup";
    }
    setEnabled(true);
  } else {
    if (isPinSet()) {
      setupStep.value = "idle";
    }
    setEnabled(false);
  }
}

async function handleSetPin() {
  errorMessage.value = "";
  successMessage.value = "";

  if (!pinEnteredValid.value) {
    errorMessage.value = "PIN 码需要 4 到 6 位数字";
    return;
  }
  if (!pinConfirmValid.value) {
    errorMessage.value = "请确认 PIN 码";
    return;
  }
  if (!pinsMatch.value) {
    errorMessage.value = "两次输入的 PIN 码不一致";
    return;
  }

  const ok = await setPin(pinEntered.value);
  if (ok) {
    successMessage.value = "PIN 码设置成功";
    pinEntered.value = "";
    pinConfirm.value = "";
    setEnabled(true);
    setupStep.value = "idle";
  } else {
    errorMessage.value = "PIN 码格式不正确，请输入 4-6 位数字";
  }
}

async function handleChangePin() {
  errorMessage.value = "";
  successMessage.value = "";

  const valid = await verifyPin(currentPinInput.value);
  if (!valid) {
    errorMessage.value = "当前 PIN 码错误";
    return;
  }

  currentPinInput.value = "";
  setupStep.value = "setup";
}

function startChangePin() {
  currentPinInput.value = "";
  errorMessage.value = "";
  successMessage.value = "";
  setupStep.value = "change";
}

function startSetup() {
  pinEntered.value = "";
  pinConfirm.value = "";
  errorMessage.value = "";
  successMessage.value = "";
  setupStep.value = "setup";
}

function cancelSetup() {
  const wasChanging = setupStep.value === "change";
  setupStep.value = "idle";
  errorMessage.value = "";
  successMessage.value = "";
  if (wasChanging) {
    currentPinInput.value = "";
  }
}

async function handleDisablePin() {
  errorMessage.value = "";
  const valid = await verifyPin(currentPinInput.value);
  if (!valid) {
    errorMessage.value = "PIN 码错误";
    return;
  }
  clearPin();
  successMessage.value = "应用锁已关闭";
  currentPinInput.value = "";
  setupStep.value = "idle";
}

onMounted(async () => {
  biometricAvailable.value = await checkBiometricSupport();
});
</script>

<template>
  <SettingSection title="应用锁" section-id="section-applock">
    <SettingItem label="启用应用锁" desc="切后台超过 5 秒后需要 PIN 码解锁">
      <n-switch
        :value="lockEnabled"
        :disabled="!isPinSet() && !lockEnabled"
        @update:value="handleToggleLock"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <template v-if="lockEnabled && isPinSet()">
      <SettingItem label="修改 PIN 码" desc="修改当前解锁密码">
        <n-button size="small" quaternary @click="startChangePin">修改</n-button>
      </SettingItem>
    </template>

    <template v-if="biometricAvailable">
      <SettingItem label="指纹解锁" desc="支持使用设备指纹快速解锁">
        <n-switch :value="biometricEnabled" @update:value="setBiometric">
          <template #checked>开启</template>
          <template #unchecked>关闭</template>
        </n-switch>
      </SettingItem>
    </template>
  </SettingSection>

  <SettingSection v-if="setupStep === 'setup'" title="设置 PIN 码" section-id="section-applock-setup">
    <div class="lock-setup-form">
      <SettingItem label="输入 PIN 码" desc="4-6 位数字密码">
        <n-input
          v-model:value="pinEntered"
          type="password"
          :maxlength="6"
          :minlength="4"
          placeholder="4-6 位数字"
          :status="pinEntered.length > 0 && !pinEnteredValid ? 'error' : undefined"
          style="width: 180px"
          :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }"
        />
      </SettingItem>

      <SettingItem label="确认 PIN 码" desc="再次输入相同的 PIN 码">
        <n-input
          v-model:value="pinConfirm"
          type="password"
          :maxlength="6"
          :minlength="4"
          placeholder="再次输入"
          :status="pinConfirm.length > 0 && !pinsMatch ? 'error' : undefined"
          style="width: 180px"
          :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }"
        />
      </SettingItem>

      <div class="lock-setup-actions">
        <n-button size="small" @click="cancelSetup">取消</n-button>
        <n-button size="small" type="primary" @click="handleSetPin">确认设置</n-button>
      </div>
    </div>
  </SettingSection>

  <SettingSection
    v-if="setupStep === 'change'"
    title="验证当前 PIN 码"
    section-id="section-applock-verify"
  >
    <div class="lock-setup-form">
      <SettingItem label="当前 PIN 码" desc="请输入当前密码以继续">
        <n-input
          v-model:value="currentPinInput"
          type="password"
          :maxlength="6"
          placeholder="当前 PIN 码"
          style="width: 180px"
          :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }"
        />
      </SettingItem>

      <div class="lock-setup-actions">
        <n-button size="small" @click="cancelSetup">取消</n-button>
        <n-button size="small" type="primary" @click="handleChangePin">验证</n-button>
        <n-button size="small" type="error" quaternary @click="handleDisablePin">关闭应用锁</n-button>
      </div>
    </div>
  </SettingSection>

  <div v-if="errorMessage" class="lock-msg lock-msg--error">
    {{ errorMessage }}
  </div>
  <div v-if="successMessage" class="lock-msg lock-msg--success">
    {{ successMessage }}
  </div>
</template>

<style scoped>
.lock-setup-form {
  display: flex;
  flex-direction: column;
}

.lock-setup-actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  justify-content: flex-end;
}

.lock-msg {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2);
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
}

.lock-msg--error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.lock-msg--success {
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  color: var(--color-success);
  border: 1px solid color-mix(in srgb, var(--color-success) 28%, transparent);
}
</style>