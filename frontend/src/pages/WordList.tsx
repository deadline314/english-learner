import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { cn } from '../lib/utils'
import { Volume2, ChevronLeft, ChevronRight, Search, BookOpen } from 'lucide-react'

interface WordItem {
  wordId: number
  word: string
  phonetic: string
  partOfSpeech: string
  definitions: { 'zh-TW': string[]; en: string[] }
  collocation: string
  secondaryMeaningNote?: string | null
  difficulty: number
}

interface WordListResponse {
  words: WordItem[]
  total: number
  page: number
  totalPages: number
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.02 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function WordList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { speak, isSpeaking } = useTTS()

  const { data, isLoading } = useQuery({
    queryKey: ['word-list', page],
    queryFn: () => api.get<WordListResponse>(`/practice/words?page=${page}`),
    placeholderData: (prev) => prev,
  })

  const filteredWords = data?.words.filter((w: WordItem) =>
    !search || w.word.toLowerCase().includes(search.toLowerCase()) ||
    w.definitions['zh-TW'].some((d: string) => d.includes(search))
  ) ?? []

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            題庫單字
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            共 <span className="font-semibold text-foreground">{data?.total ?? 0}</span> 個單字，
            第 {data?.page ?? 1} / {data?.totalPages ?? 1} 頁
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜尋單字或中文意思..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-2"
      >
        {filteredWords.map((word) => (
          <motion.div
            key={word.wordId}
            variants={itemVariants}
            className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => speak(word.word)}
                className={cn(
                  'p-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all shrink-0',
                  isSpeaking && 'animate-pulse'
                )}
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{word.word}</span>
                  <span className="text-xs text-muted-foreground">{word.phonetic}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">{word.partOfSpeech}</span>
                  {word.secondaryMeaningNote && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded">⚡ 次要意義</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {word.definitions['zh-TW']?.join('；')}
                </p>
                {word.collocation && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                    {word.collocation}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1.5 h-4 rounded-full',
                      i < word.difficulty ? 'bg-primary/60' : 'bg-border'
                    )}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-card border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(7, data?.totalPages ?? 0) }).map((_, i) => {
              const totalPages = data?.totalPages ?? 0
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (page <= 4) {
                pageNum = i + 1
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = page - 3 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-sm font-medium transition-all',
                    page === pageNum
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setPage(p => Math.min(data?.totalPages ?? 1, p + 1))}
            disabled={page >= (data?.totalPages ?? 1)}
            className="p-2 rounded-lg bg-card border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}
