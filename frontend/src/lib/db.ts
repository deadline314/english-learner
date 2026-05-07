import Dexie, { type Table } from 'dexie'

export interface CachedWord {
  wordId: number
  word: string
  phonetic: string
  partOfSpeech: string
  definitions: { 'zh-TW': string[]; en: string[] }
  analysis?: any
  collocation: string
  examples: { en: string; 'zh-TW': string }[]
  wordFamily: Record<string, string>
  difficulty: number
  frequencyRank: number
}

export interface CachedPracticeSession {
  sessionId: string
  mode: string
  items: any[]
  startedAt: number
}

export interface PendingSubmission {
  id?: number
  sessionId: string
  mode: string
  answers: any[]
  createdAt: number
}

class EnglishLearnerDB extends Dexie {
  words!: Table<CachedWord, number>
  sessions!: Table<CachedPracticeSession, string>
  pendingSubmissions!: Table<PendingSubmission, number>

  constructor() {
    super('english-learner-db')
    this.version(1).stores({
      words: 'wordId, word, difficulty, frequencyRank',
      sessions: 'sessionId, mode, startedAt',
      pendingSubmissions: '++id, sessionId, createdAt',
    })
  }
}

export const db = new EnglishLearnerDB()

export async function cachePracticeSession(sessionId: string, mode: string, items: any[]) {
  await db.sessions.put({
    sessionId,
    mode,
    items,
    startedAt: Date.now(),
  })
}

export async function getCachedSession(sessionId: string) {
  return db.sessions.get(sessionId)
}

export async function savePendingSubmission(sessionId: string, mode: string, answers: any[]) {
  await db.pendingSubmissions.add({
    sessionId,
    mode,
    answers,
    createdAt: Date.now(),
  })
}

export async function getPendingSubmissions() {
  return db.pendingSubmissions.toArray()
}

export async function clearPendingSubmission(id: number) {
  await db.pendingSubmissions.delete(id)
}

export async function syncPendingSubmissions(submitFn: (data: any) => Promise<any>) {
  const pending = await getPendingSubmissions()
  for (const submission of pending) {
    try {
      await submitFn({
        sessionId: submission.sessionId,
        mode: submission.mode,
        answers: submission.answers,
      })
      await clearPendingSubmission(submission.id!)
    } catch {
      break
    }
  }
}
