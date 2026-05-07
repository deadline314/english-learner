const SESSION_KEY_PREFIX = 'practice-session-'

interface SavedSession {
  sessionId: string
  items: any[]
  currentIndex: number
  answers: any[]
  mode: string
  savedAt: number
}

export function saveSession(mode: string, data: SavedSession) {
  try {
    localStorage.setItem(`${SESSION_KEY_PREFIX}${mode}`, JSON.stringify(data))
  } catch {}
}

export function loadSession(mode: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${mode}`)
    if (!raw) return null
    const session: SavedSession = JSON.parse(raw)
    const oneHour = 60 * 60 * 1000
    if (Date.now() - session.savedAt > oneHour) {
      clearSession(mode)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearSession(mode: string) {
  localStorage.removeItem(`${SESSION_KEY_PREFIX}${mode}`)
}
