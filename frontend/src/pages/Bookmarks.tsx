import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { Star, Eye, X as XIcon, BookOpen, MessageSquare, Sparkles } from 'lucide-react'
import { BookmarkStar } from '../components/BookmarkStar'

type BookmarkType = 'seen' | 'wrong'

interface BookmarkItem {
  bookmarkType: string
  itemType: 'word' | 'grammar' | 'phrase'
  createdAt: number
  item: any
}

const ITEM_TYPE_ICON = {
  word: BookOpen,
  grammar: MessageSquare,
  phrase: Sparkles,
}

const ITEM_TYPE_LABEL = {
  word: '單字',
  grammar: '文法',
  phrase: '片語',
}

function WordCard({ item, bookmarkType }: { item: any; bookmarkType: BookmarkType }) {
  const [expanded, setExpanded] = useState(false)
  const defs = item.definitions?.['zh-TW'] ?? []
  return (
    <motion.div layout className="bg-card border border-border rounded-xl p-4 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground text-lg">{item.word}</span>
            <span className="text-muted-foreground text-sm">{item.phonetic}</span>
            <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">{item.partOfSpeech}</span>
            {item.toeicRank && (
              <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-400/20 rounded font-bold">
                TOEIC #{item.toeicRank}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">{defs[0]}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <BookmarkStar itemType="word" itemId={item.wordId} bookmarkType={bookmarkType} initialBookmarked />
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2 border-t border-border space-y-2">
              {defs.map((d: string, i: number) => <p key={i} className="text-sm text-foreground">{d}</p>)}
              {item.collocation && <p className="text-xs text-muted-foreground"><span className="font-medium">Collocation:</span> {item.collocation}</p>}
              {item.examples?.[0] && (
                <div className="border-l-2 border-primary/30 pl-3 text-sm">
                  <p className="text-foreground">{item.examples[0].en}</p>
                  <p className="text-muted-foreground">{item.examples[0]['zh-TW']}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function GrammarCard({ item, bookmarkType }: { item: any; bookmarkType: BookmarkType }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <motion.div layout className="bg-card border border-border rounded-xl p-4 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-primary font-medium mb-1">{item.topicTitle}</p>
          <p className="text-sm text-foreground line-clamp-2">{item.question}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <BookmarkStar itemType="grammar" itemId={item.id} bookmarkType={bookmarkType} initialBookmarked />
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-sm font-medium text-foreground">答案：<span className="text-emerald-600 dark:text-emerald-400">{item.correctAnswer}</span></p>
              {item.explanation && <p className="text-sm text-muted-foreground">{item.explanation}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PhraseCard({ item, bookmarkType }: { item: any; bookmarkType: BookmarkType }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <motion.div layout className="bg-card border border-border rounded-xl p-4 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground">{item.phrase}</span>
            <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">{item.category}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{item.meaningZh}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <BookmarkStar itemType="phrase" itemId={item.id} bookmarkType={bookmarkType} initialBookmarked />
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-sm text-foreground">{item.meaningEn}</p>
              {item.examples?.filter((e: any) => e.en).map((ex: any, i: number) => (
                <div key={i} className="border-l-2 border-primary/30 pl-3 text-sm">
                  <p className="text-foreground">{ex.en}</p>
                  <p className="text-muted-foreground">{ex['zh-TW']}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const TAB_CONFIG = [
  { type: 'seen' as BookmarkType, label: '看過收藏', icon: Star, color: 'text-amber-500', activeBg: 'bg-amber-500/10 border-amber-400/30', activeText: 'text-amber-600 dark:text-amber-400' },
  { type: 'wrong' as BookmarkType, label: '錯題收藏', icon: XIcon, color: 'text-rose-500', activeBg: 'bg-rose-500/10 border-rose-400/30', activeText: 'text-rose-600 dark:text-rose-400' },
]

const TYPE_FILTER = [
  { value: 'all', label: '全部' },
  { value: 'word', label: '單字' },
  { value: 'grammar', label: '文法' },
  { value: 'phrase', label: '片語' },
]

export default function Bookmarks() {
  const [activeTab, setActiveTab] = useState<BookmarkType>('seen')
  const [typeFilter, setTypeFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks', activeTab],
    queryFn: () => api.get<{ items: BookmarkItem[]; type: string }>(`/practice/bookmarks?type=${activeTab}`),
  })

  const items = (data?.items ?? []).filter(item => typeFilter === 'all' || item.itemType === typeFilter)

  const tabConfig = TAB_CONFIG.find(t => t.type === activeTab)!

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-500 fill-amber-500" /> 我的收藏
        </h1>
        <p className="text-muted-foreground text-sm">收藏看過的題目和答錯的題目，方便複習</p>
      </motion.div>

      <div className="flex gap-2">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.type
          return (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border font-medium text-sm transition-all',
                isActive ? `${tab.activeBg} ${tab.activeText}` : 'bg-card border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive && tab.color, !isActive && 'opacity-50')} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        {TYPE_FILTER.map(f => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              typeFilter === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', tabConfig.activeBg)}>
            <Star className={cn('w-8 h-8', tabConfig.color)} />
          </div>
          <p className="text-foreground font-medium">還沒有{tabConfig.label}</p>
          <p className="text-muted-foreground text-sm max-w-xs">
            {activeTab === 'seen' ? '練習時按下 ⭐ 可以把看過的題目加入收藏' : '答錯時按下 ⭐ 可以把錯題加入收藏'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">共 {items.length} 筆</p>
          {items.map((b, i) => {
            const Icon = ITEM_TYPE_ICON[b.itemType]
            return (
              <motion.div key={`${b.itemType}-${b.item.wordId ?? b.item.id}-${i}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{ITEM_TYPE_LABEL[b.itemType]}</span>
                </div>
                {b.itemType === 'word' && <WordCard item={b.item} bookmarkType={activeTab} />}
                {b.itemType === 'grammar' && <GrammarCard item={b.item} bookmarkType={activeTab} />}
                {b.itemType === 'phrase' && <PhraseCard item={b.item} bookmarkType={activeTab} />}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
