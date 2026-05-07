import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('請輸入有效的 email'),
  password: z.string().min(8, '密碼至少 8 個字元').max(100),
})

export const verifySchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6, '驗證碼為 6 位數'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
})

export const userSettingsSchema = z.object({
  accent: z.enum(['us', 'uk']).default('us'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  dailyGoal: z.number().int().min(5).max(100).default(20),
  interfaceLang: z.enum(['zh-TW', 'en']).default('zh-TW'),
  definitionLang: z.enum(['zh-TW', 'en', 'both']).default('both'),
  showPhonetic: z.boolean().default(true),
  showEtymology: z.boolean().default(true),
  autoPlayAudio: z.boolean().default(false),
  keyboardShortcuts: z.boolean().default(true),
})

export const onboardingSchema = z.object({
  level: z.enum(['beginner', 'intermediate', 'upper-intermediate', 'advanced']),
  dailyGoal: z.number().int().min(5).max(100),
  learningGoal: z.enum(['daily', 'academic', 'business', 'exam']),
  accent: z.enum(['us', 'uk']),
})

export const practiceSubmitSchema = z.object({
  sessionId: z.string().uuid(),
  mode: z.enum(['word', 'grammar', 'phrase', 'mixed']),
  answers: z.array(z.object({
    itemId: z.number().int(),
    itemType: z.enum(['word', 'grammar', 'phrase']),
    correct: z.boolean(),
    timeMs: z.number().int(),
    userAnswer: z.string().optional(),
  })),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type VerifyInput = z.infer<typeof verifySchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type UserSettings = z.infer<typeof userSettingsSchema>
export type OnboardingInput = z.infer<typeof onboardingSchema>
export type PracticeSubmitInput = z.infer<typeof practiceSubmitSchema>

export interface User {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  emailVerified: boolean
  createdAt: number
}

export interface UserStreak {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string
  totalDays: number
}

export interface Word {
  wordId: number
  word: string
  phonetic: string
  partOfSpeech: string
  definitions: { 'zh-TW': string[]; en: string[] }
  analysis?: {
    prefix?: { text: string; meaning: string }
    root?: { text: string; meaning: string }
    suffix?: { text: string; meaning: string }
    logic: string
  }
  collocation: string
  examples: { en: string; 'zh-TW': string }[]
  wordFamily: Record<string, string>
  secondaryMeaningNote?: string | null
  difficulty: number
  frequencyRank: number
}

export interface GrammarQuestion {
  id: number
  topicId: number
  topicTitle: string
  questionType: 'multiple_choice' | 'fill_blank' | 'transform' | 'reorder'
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

export interface Phrase {
  id: number
  phrase: string
  meaningZh: string
  meaningEn: string
  examples: { en: string; 'zh-TW': string }[]
  category: string
}

export interface PracticeItem {
  item: Word | GrammarQuestion | Phrase
  itemType: 'word' | 'grammar' | 'phrase'
  questionVariant: string
}

export interface DashboardData {
  todayProgress: { completed: number; total: number }
  streak: UserStreak
  wordsDue: number
  grammarDue: number
  phrasesDue: number
  wordsNew: number
  grammarNew: number
  phrasesNew: number
  recentWrong: WrongAnswer[]
  weeklyActivity: { date: string; count: number }[]
}

export interface WrongAnswer {
  id: number
  itemType: 'word' | 'grammar' | 'phrase'
  itemId: number
  userAnswer: string
  correctAnswer: string
  createdAt: number
  mastered: boolean
  item?: Word | GrammarQuestion | Phrase
}

export interface StatsData {
  totalDays: number
  totalAnswered: number
  correctRate: number
  currentStreak: number
  dailyActivity: { date: string; count: number; correct: number }[]
  typeDistribution: { type: string; count: number }[]
  srsDistribution: { level: number; count: number }[]
  hardestWords: { word: string; wrongCount: number }[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
