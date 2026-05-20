/**
 * useReaderPerformance — 阅读器性能检测与动效降级
 *
 * 检测设备性能指标，用于在低端设备上自动降级翻页动效：
 *   - prefers-reduced-motion 用户偏好
 *   - 设备内存 (navigator.deviceMemory)
 *   - CPU 核心数 (navigator.hardwareConcurrency)
 *   - 移动端浏览器类型检测（非 Safari Android WebView 性能较差）
 *
 * 用法：
 *   import { useReaderPerformance } from '@/composables/useReaderPerformance'
 *   const { isLowEnd, prefersReducedMotion } = useReaderPerformance()
 *   // isLowEnd 和 prefersReducedMotion 都是 ComputedRef<boolean>
 */

import { ref, computed, onMounted } from 'vue';

const KNOWN_LOW_END_DEVICES = [
  'HUAWEI TAG-AL00',
  'HUAWEI LDN-LX2',
  'HUAWEI MED-LX9',
  'Xiaomi M2004j',
  'Redmi 9A',
  'Redmi 8A',
  'OPPO A5',
  'OPPO A8',
  'vivo Y3',
  'vivo Y50',
  'Samsung SM-A',
  'Samsung SM-J',
  'Galaxy J',
];

function detectLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toUpperCase();
  return KNOWN_LOW_END_DEVICES.some((model) => ua.includes(model));
}

function detectNonSafariMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
  if (!isMobileUA) return false;
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/Firefox/i.test(ua);
  const isFirefox = /Firefox/i.test(ua) && /Android/i.test(ua);
  return !isSafari && !isFirefox;
}

export function useReaderPerformance() {
  const prefersReducedMotion = ref(false);
  const deviceMemory = ref(8);
  const hardwareConcurrency = ref(navigator.hardwareConcurrency ?? 4);

  onMounted(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.value = mq.matches;
    mq.addEventListener('change', (e) => {
      prefersReducedMotion.value = e.matches;
    });

    deviceMemory.value = (navigator as any).deviceMemory ?? 8;
  });

  const isLowMemory = computed(() => deviceMemory.value < 4);

  const isLowEndDeviceModel = computed(() => detectLowEndDevice());

  const isNonSafariMobile = computed(() => detectNonSafariMobile());

  const isLowEnd = computed(() => {
    if (prefersReducedMotion.value) return true;
    if (isLowMemory.value) return true;
    if (isLowEndDeviceModel.value) return true;
    if (isNonSafariMobile.value) return true;
    if (hardwareConcurrency.value <= 4) return true;
    return false;
  });

  return {
    isLowEnd,
    prefersReducedMotion,
    isLowMemory,
    hardwareConcurrency,
  };
}
