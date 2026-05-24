import { ref, computed, onMounted, onUnmounted, readonly } from "vue";

const STORAGE_KEY = "legado-bluetooth-filter";

export interface BlueLightFilterSchedule {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

interface StoredConfig {
  enabled: boolean;
  intensity: number;
  schedule: BlueLightFilterSchedule;
}

function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredConfig;
      return {
        enabled: parsed.enabled ?? false,
        intensity: clampIntensity(parsed.intensity),
        schedule: normalizeSchedule(parsed.schedule),
      };
    }
  } catch {
    // ignore corrupted data
  }
  return {
    enabled: false,
    intensity: 0.5,
    schedule: { startHour: 22, startMinute: 0, endHour: 6, endMinute: 0 },
  };
}

function saveConfig(config: StoredConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function clampIntensity(value: number): number {
  return Math.max(0.3, Math.min(0.7, value));
}

function normalizeSchedule(schedule: Partial<BlueLightFilterSchedule> | undefined): BlueLightFilterSchedule {
  return {
    startHour: schedule?.startHour ?? 22,
    startMinute: schedule?.startMinute ?? 0,
    endHour: schedule?.endHour ?? 6,
    endMinute: schedule?.endMinute ?? 0,
  };
}

function computeIsNightTime(schedule: BlueLightFilterSchedule): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = schedule.startHour * 60 + schedule.startMinute;
  const endMinutes = schedule.endHour * 60 + schedule.endMinute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

let _timer: ReturnType<typeof setInterval> | null = null;
const _config = loadConfig();

export function useBlueLightFilter() {
  const enabled = ref(_config.enabled);
  const intensity = ref(_config.intensity);
  const schedule = ref<BlueLightFilterSchedule>({ ..._config.schedule });

  const isNightTime = ref(computeIsNightTime(schedule.value));
  const effectiveEnabled = computed(() => enabled.value && isNightTime.value);

  const cssIntensity = computed(() => intensity.value.toString());

  function persist() {
    saveConfig({
      enabled: enabled.value,
      intensity: intensity.value,
      schedule: { ...schedule.value },
    });
  }

  function toggle() {
    enabled.value = !enabled.value;
    persist();
  }

  function setIntensity(value: number) {
    intensity.value = clampIntensity(value);
    persist();
  }

  function setSchedule(s: BlueLightFilterSchedule) {
    schedule.value = normalizeSchedule(s);
    isNightTime.value = computeIsNightTime(schedule.value);
    persist();
  }

  function checkNightTime() {
    isNightTime.value = computeIsNightTime(schedule.value);
  }

  onMounted(() => {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(checkNightTime, 60000);
  });

  onUnmounted(() => {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  });

  return {
    enabled: readonly(enabled),
    intensity: readonly(intensity),
    schedule: readonly(schedule),
    isNightTime: readonly(isNightTime),
    effectiveEnabled: readonly(effectiveEnabled),
    cssIntensity: readonly(cssIntensity),
    toggle,
    setIntensity,
    setSchedule,
    checkNightTime,
  };
}