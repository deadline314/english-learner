import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import {
  Volume2, CheckCircle2, ChevronDown, ChevronUp,
  RotateCcw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type TabType = 'word' | 'grammar' | 'phrase'
type FilterType = 'all' | 'unmastered' | 'mastered'

interface WrongItem {
  id: string
  question: string
  yourAnswer: string
  correctAnswer: string
  timestamp: number
  mastered: boolean
  phonetic?: string
  details?: string
}

interface ApiWrongItem {
  id: number
  itemType: string
  itemId: number
  userAnswer: string
  correctAnswer: string
  createdAt: number
  mastered: boolean
  word?: string
  phonetic?: string
  definitions?: { 'zh-TW'?: string[]; en?: string[] }
  question?: string
  explanation?: string
  phrase?: string
  meaningZh?: string
}

interface WrongResponse {
  items: WrongItem[]
  total: number
  page: number
  pageSize: number
}

const TABS: { key: TabType; label: string }[] = [
  { key: 'word', label: 'Word' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'phrase', label: 'Phrase' },
]

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unmastered', label: 'Unmastered' },
  { key: 'mastered', label: 'Mastered' },
]

export default function ReviewWrong() {
  const [type, setType] = useState<TabType>('word')
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { speak, isSpeaking } = useTTS()

  const { data, isLoading } = useQuery<WrongResponse>({
    queryKey: ['wrong', type, filter, page],
    queryFn: async () => {
      const raw = await api.get<{ items: ApiWrongItem[]; total: number; page: number; pageSize: number }>(`/progress/wrong?type=${type}&page=${page}&filter=${filter}`)
      return {
        ...raw,
        items: raw.items.map((item) => {
          let question = ''
          let details = ''
          let correctAnswer = item.correctAnswer || ''

          if (item.word) {
            question = item.word
            correctAnswer = correctAnswer || item.word
            if (item.definitions?.['zh-TW']) {
              details = item.definitions['zh-TW'].join('；')
            }
          } else if (item.question) {
            question = item.question
            if (item.explanation) details = item.explanation
          } else if (item.phrase) {
            question = item.phrase
            if (item.meaningZh) details = item.meaningZh
          }

          return {
            id: String(item.id),
            question,
            yourAnswer: item.userAnswer || '(empty)',
            correctAnswer,
            timestamp: item.createdAt,
            mastered: item.mastered,
            phonetic: item.phonetic,
            details,
          }
        }),
      }
    },
  })

  const masterMutation = useMutation({
    mutationFn: (id: string) => api.post(`/progress/wrong/${id}/master`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wrong'] })
      showToast('Marked as mastered!', 'success')
    },
    onError: () => showToast('Failed to update', 'error'),
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">錯題本</h1>
        {data && data.items.length > 0 && (
          <button
            onClick={() => navigate(`/practice/${type}`)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm font-medium transition-all"
          >
            <RotateCcw size={16} />
            Re-practice all
          </button>
        )}
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

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1) }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              filter === f.key
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700"
                : "border-border text-muted-foreground hover:border-indigo-300"
            )}
          >
            {f.label}
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
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No wrong answers here!</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Keep up the great work. Every mistake is a step toward mastery.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {data.items.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-foreground truncate">{item.question}</span>
                      {item.mastered && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs rounded-full">
                          Mastered
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Your answer:</span>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">{item.yourAnswer}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Correct:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{item.correctAnswer}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(item.timestamp * 1000).toLocaleDateString('zh-TW', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {type !== 'grammar' && (
                      <button
                        onClick={() => speak(item.question)}
                        disabled={isSpeaking}
                        className={cn(
                          "p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all",
                          isSpeaking && "animate-pulse ring-2 ring-primary/30"
                        )}
                      >
                        <Volume2 size={18} />
                      </button>
                    )}
                    {!item.mastered && (
                      <button
                        onClick={() => masterMutation.mutate(item.id)}
                        disabled={masterMutation.isPending}
                        className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                        title="Mark as mastered"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                    {item.details && (
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                      >
                        {expandedId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === item.id && item.details && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground">
                        {item.details}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
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
