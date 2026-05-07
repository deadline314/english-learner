import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import {
  Volume2, CheckCircle2, Star, X, Trash2,
  RotateCcw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type TabType = 'word' | 'grammar' | 'phrase'
type FilterType = 'all' | 'unmastered' | 'mastered'

interface WrongItem {
  id: string
  itemType: string
  itemId: number
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
  grammarCorrect?: string
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
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<WrongItem | null>(null)
  const [showClearAll, setShowClearAll] = useState(false)

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
            if (item.definitions?.['zh-TW']) {
              correctAnswer = correctAnswer || item.definitions['zh-TW'].join('；')
              details = item.definitions['zh-TW'].join('；')
            } else {
              correctAnswer = correctAnswer || item.word
            }
          } else if (item.question) {
            question = item.question
            correctAnswer = correctAnswer || item.grammarCorrect || ''
            if (item.explanation) details = item.explanation
          } else if (item.phrase) {
            question = item.phrase
            correctAnswer = correctAnswer || item.meaningZh || ''
            if (item.meaningZh) details = item.meaningZh
          }

          return {
            id: String(item.id),
            itemType: item.itemType,
            itemId: item.itemId,
            question,
            yourAnswer: item.userAnswer || '(未記錄)',
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/progress/wrong/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wrong'] })
      showToast('已刪除', 'success')
      setDeleteTarget(null)
    },
    onError: () => showToast('刪除失敗', 'error'),
  })

  const clearAllMutation = useMutation({
    mutationFn: () => api.delete(`/progress/wrong/clear/${type}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wrong'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast('已全部清空', 'success')
      setShowClearAll(false)
    },
    onError: () => showToast('清空失敗', 'error'),
  })

  const toggleBookmark = async (item: WrongItem) => {
    try {
      const res = await api.post<{ bookmarked: boolean }>('/practice/bookmark', {
        itemType: item.itemType,
        itemId: item.itemId,
        bookmarkType: 'wrong',
      })
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (res.bookmarked) next.add(item.id)
        else next.delete(item.id)
        return next
      })
      showToast(res.bookmarked ? '已收藏' : '已取消收藏', 'success')
    } catch {
      showToast('操作失敗', 'error')
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">錯題本</h1>
        {data && data.items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearAll(true)}
              className="flex items-center gap-2 px-4 py-2 border border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium transition-all"
            >
              <Trash2 size={16} />
              清空全部
            </button>
            <button
              onClick={() => navigate(`/practice/${type}`)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm font-medium transition-all"
            >
              <RotateCcw size={16} />
              Re-practice all
            </button>
          </div>
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
                exit={{ opacity: 0, x: -50 }}
                transition={{ delay: index * 0.04 }}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-foreground text-lg">{item.question}</span>
                      {item.phonetic && (
                        <span className="text-xs text-muted-foreground">{item.phonetic}</span>
                      )}
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
                      {item.details && item.details !== item.correctAnswer && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-20 shrink-0">Details:</span>
                          <span className="text-foreground/80 text-xs">{item.details}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {item.timestamp ? new Date(item.timestamp * 1000).toLocaleDateString('zh-TW', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      }) : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleBookmark(item)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        bookmarkedIds.has(item.id)
                          ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                          : "text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      )}
                      title={bookmarkedIds.has(item.id) ? '取消收藏' : '收藏'}
                    >
                      <Star size={18} fill={bookmarkedIds.has(item.id) ? 'currentColor' : 'none'} />
                    </button>
                    {type !== 'grammar' && (
                      <button
                        onClick={() => { setSpeakingId(item.id); speak(item.question) }}
                        disabled={isSpeaking}
                        className={cn(
                          "p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all",
                          isSpeaking && speakingId === item.id && "animate-pulse ring-2 ring-primary/30"
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
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      title="刪除"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
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

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground mb-2">確認刪除</h3>
              <p className="text-sm text-muted-foreground mb-1">
                確定要刪除這筆錯題紀錄嗎？
              </p>
              <p className="text-sm font-medium text-foreground mb-5">
                「{deleteTarget.question}」
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm"
                >
                  {deleteMutation.isPending ? '刪除中...' : '確認刪除'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowClearAll(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground mb-2">清空全部錯題</h3>
              <p className="text-sm text-muted-foreground mb-5">
                確定要清空所有「{TABS.find(t => t.key === type)?.label}」類型的錯題紀錄嗎？此操作無法復原。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowClearAll(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm"
                >
                  {clearAllMutation.isPending ? '清空中...' : '確認清空'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
