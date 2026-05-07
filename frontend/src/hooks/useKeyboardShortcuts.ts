import { useEffect, useCallback } from 'react'

export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  enabled = true
) {
  const handler = useCallback((e: KeyboardEvent) => {
    if (!enabled) return
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    const key = e.key.toLowerCase()
    if (shortcuts[key]) {
      e.preventDefault()
      shortcuts[key]()
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
