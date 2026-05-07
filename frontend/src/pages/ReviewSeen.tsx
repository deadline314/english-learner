import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { cn } from '../lib/utils'
import {
  Volume2, ChevronLeft, ChevronRight, BookOpen, Target, TrendingUp,
} from 'lucide-react'

type TabType = 'word' | 'grammar' | 'phrase'

interface SeenItem {
  id: string
  content: string
  phonetic?: string
  srsLevel: number
  seenCount: number
  correctCount: number
  wrongCount: number
  nextReview: string
}

interface SeenResponse {
  items: SeenItem[]
  total: number
  page: number
  pageSize: number
}

const TABS: { key: TabType; label: string }[] = [
  { key: 'word', label: 'Word' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'phrase', label: 'Phrase' },
]

const SRS_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7] as const

function getSrsColor(level: number) {
  if (level <= 1) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  if (level <= 3) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (level <= 5) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
}

function getSrsBorderColor(level: number) {
  if (level <= 1) return 'border-rose-300 dark:border-rose-700'
  if (level <= 3) return 'border-amber-300 dark:border-amber-700'
  if (level <= 5) return 'border-blue-300 dark:border-blue-700'
  return 'border-emerald-300 dark:border-emerald-700'
}

export default function ReviewSeen() {
  const [type, setType] = useState<TabType>('word')
  const [level, setLevel] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const { speak, isSpeaking } = useTTS()

  const { data, isLoading } = useQuery<SeenResponse>({
    queryKey: ['seen', type, level, page],
    queryFn: () => {
      const params = new URLSearchParams({ type, page: String(page) })
      if (level !== null) params.set('srs_level', String(level))
      return api.get(`/progress/seen?${params.toString()}`)
    },
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  const totalItems = data?.total ?? 0
  const masteryBreakdown = data?.items.reduce(
    (acc, item) => {
      if (item.srsLevel <= 1) acc.beginner++
      else if (item.srsLevel <= 3) acc.learning++
      else if (item.srsLevel <= 5) acc.familiar++
      else acc.mastered++
      return acc
    },
    { beginner: 0, learning: 0, familiar: 0, mastered: 0 }
  ) ?? { beginner: 0, learning: 0, familiar: 0, mastered: 0 }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">已看題目</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BookOpen size={16} />
            <span className="text-xs font-medium">Total Seen</span>
          </div>
          <span className="text-xl font-bold text-foreground">{totalItems}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
            <Target size={16} />
            <span className="text-xs font-medium">Beginner</span>
          </div>
          <span className="text-xl font-bold text-foreground">{masteryBreakdown.beginner}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Learning</span>
          </div>
          <span className="text-xl font-bold text-foreground">{masteryBreakdown.learning}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <Target size={16} />
            <span className="text-xs font-medium">Mastered</span>
          </div>
          <span className="text-xl font-bold text-foreground">{masteryBreakdown.mastered}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1 bg-muted rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setType(tab.key); setPage(1) }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              type === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setLevel(null); setPage(1) }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
            level === null
              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700"
              : "border-border text-muted-foreground hover:border-indigo-300"
          )}
        >
          All Levels
        </button>
        {SRS_LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => { setLevel(l); setPage(1) }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              level === l
                ? cn(getSrsColor(l), getSrsBorderColor(l))
                : "border-border text-muted-foreground hover:border-indigo-300"
            )}
          >
            Lv.{l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
            <BookOpen className="text-indigo-600 dark:text-indigo-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Nothing here yet</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Start practicing to see your progress here!
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-foreground">{item.content}</span>
                    {item.phonetic && (
                      <span className="text-xs text-muted-foreground">/{item.phonetic}/</span>
                    )}
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getSrsColor(item.srsLevel))}>
                      Lv.{item.srsLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span>Seen <strong className="text-foreground">{item.seenCount}</strong> times</span>
                    <span>Correct <strong className="text-emerald-600 dark:text-emerald-400">{item.correctCount}</strong></span>
                    <span>Wrong <strong className="text-rose-600 dark:text-rose-400">{item.wrongCount}</strong></span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Next review: {new Date(item.nextReview).toLocaleDateString('zh-TW', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                {type !== 'grammar' && (
                  <button
                    onClick={() => speak(item.content)}
                    disabled={isSpeaking}
                    className={cn(
                      "p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all shrink-0",
                      isSpeaking && "animate-pulse ring-2 ring-primary/30"
                    )}
                  >
                    <Volume2 size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-muted-foreground px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
