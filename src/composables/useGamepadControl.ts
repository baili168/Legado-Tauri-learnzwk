import { ref } from 'vue'
import { useReaderActionsStore } from '@/features/reader/stores/readerActions'

export function useGamepadControl() {
  const readerActions = useReaderActionsStore()
  const active = ref(false)
  const rafId = ref(0)
  const prevButtonState = ref<boolean[]>([])

  function pollGamepad(): void {
    if (!active.value) return

    const gamepads = navigator.getGamepads?.()
    if (!gamepads) {
      rafId.value = requestAnimationFrame(pollGamepad)
      return
    }

    for (const gp of gamepads) {
      if (!gp) continue

      const buttons = gp.buttons.map((b) => b.pressed)

      if (buttons[4] && !prevButtonState.value[4]) {
        readerActions.onTap('left')
      }
      if (buttons[5] && !prevButtonState.value[5]) {
        readerActions.onTap('right')
      }
      if (buttons[6] && !prevButtonState.value[6]) {
        readerActions.gotoPrevChapter()
      }
      if (buttons[7] && !prevButtonState.value[7]) {
        readerActions.gotoNextChapter()
      }

      if (gp.axes.length >= 2) {
        const dpadX = gp.axes[0]
        const dpadY = gp.axes[1]

        if (Math.abs(dpadX) > 0.5) {
          if (dpadX < -0.5 && !prevButtonState.value[14]) {
            readerActions.onTap('left')
          } else if (dpadX > 0.5 && !prevButtonState.value[15]) {
            readerActions.onTap('right')
          }
        }
      }

      prevButtonState.value = buttons
    }

    rafId.value = requestAnimationFrame(pollGamepad)
  }

  function startListening(): void {
    if (active.value) return
    active.value = true
    prevButtonState.value = []
    rafId.value = requestAnimationFrame(pollGamepad)
  }

  function stopListening(): void {
    active.value = false
    if (rafId.value) {
      cancelAnimationFrame(rafId.value)
      rafId.value = 0
    }
  }

  return {
    active,
    startListening,
    stopListening,
  }
}