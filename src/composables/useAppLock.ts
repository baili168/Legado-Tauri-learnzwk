import { ref, readonly } from "vue";

const STORAGE_KEY_PIN_HASH = "legado-applock-pin-hash";
const STORAGE_KEY_SALT = "legado-applock-salt";
const STORAGE_KEY_ENABLED = "legado-applock-enabled";
const STORAGE_KEY_BIOMETRIC = "legado-applock-biometric";
const AUTO_LOCK_DELAY_MS = 5000;

let _hiddenAt = 0;

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bufferToHex(arr);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + ":" + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

function getStoredSalt(): string {
  let salt = localStorage.getItem(STORAGE_KEY_SALT);
  if (!salt) {
    salt = generateSalt();
    localStorage.setItem(STORAGE_KEY_SALT, salt);
  }
  return salt;
}

const isLocked = ref(false);
const lockEnabled = ref(localStorage.getItem(STORAGE_KEY_ENABLED) === "true");
const biometricEnabled = ref(localStorage.getItem(STORAGE_KEY_BIOMETRIC) === "true");

const pinHash = ref<string | null>(localStorage.getItem(STORAGE_KEY_PIN_HASH));

function persistEnabled() {
  localStorage.setItem(STORAGE_KEY_ENABLED, lockEnabled.value ? "true" : "false");
}

function persistBiometric() {
  localStorage.setItem(STORAGE_KEY_BIOMETRIC, biometricEnabled.value ? "true" : "false");
}

export function useAppLock() {
  function recordVisibilityChange() {
    if (typeof document === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        _hiddenAt = Date.now();
      } else if (document.visibilityState === "visible") {
        if (lockEnabled.value && isPinSet() && _hiddenAt > 0) {
          const elapsed = Date.now() - _hiddenAt;
          if (elapsed >= AUTO_LOCK_DELAY_MS) {
            lockApp();
          }
        }
        _hiddenAt = 0;
      }
    });
  }

  async function setPin(pin: string): Promise<boolean> {
    if (pin.length < 4 || pin.length > 6) return false;
    if (!/^\d+$/.test(pin)) return false;

    const salt = getStoredSalt();
    const hash = await hashPin(pin, salt);
    pinHash.value = hash;
    localStorage.setItem(STORAGE_KEY_PIN_HASH, hash);
    return true;
  }

  async function verifyPin(pin: string): Promise<boolean> {
    const salt = getStoredSalt();
    const stored = localStorage.getItem(STORAGE_KEY_PIN_HASH);
    if (!stored) return false;
    const hash = await hashPin(pin, salt);
    return hash === stored;
  }

  function isPinSet(): boolean {
    return localStorage.getItem(STORAGE_KEY_PIN_HASH) !== null;
  }

  function clearPin() {
    localStorage.removeItem(STORAGE_KEY_PIN_HASH);
    localStorage.removeItem(STORAGE_KEY_SALT);
    pinHash.value = null;
    lockEnabled.value = false;
    persistEnabled();
    if (isLocked.value) {
      isLocked.value = false;
    }
  }

  function lockApp() {
    if (lockEnabled.value && isPinSet()) {
      isLocked.value = true;
    }
  }

  function unlockApp(pin: string): Promise<boolean> {
    return verifyPin(pin).then((valid) => {
      if (valid) {
        isLocked.value = false;
      }
      return valid;
    });
  }

  function setEnabled(enabled: boolean) {
    lockEnabled.value = enabled;
    persistEnabled();
  }

  function setBiometric(enabled: boolean) {
    biometricEnabled.value = enabled;
    persistBiometric();
  }

  function isBiometricAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof PublicKeyCredential !== "undefined" &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== undefined
    );
  }

  async function checkBiometricSupport(): Promise<boolean> {
    if (!isBiometricAvailable()) return false;
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch {
      return false;
    }
  }

  async function authenticateBiometric(): Promise<boolean> {
    if (!isBiometricAvailable()) return false;

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname || "localhost",
          allowCredentials: [],
          userVerification: "required",
          timeout: 30000,
        },
      })) as PublicKeyCredential | null;

      if (credential) {
        isLocked.value = false;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return {
    isLocked: readonly(isLocked),
    lockEnabled: readonly(lockEnabled),
    biometricEnabled: readonly(biometricEnabled),
    setPin,
    verifyPin,
    isPinSet,
    clearPin,
    lockApp,
    unlockApp,
    setEnabled,
    setBiometric,
    isBiometricAvailable,
    checkBiometricSupport,
    authenticateBiometric,
    recordVisibilityChange,
  };
}