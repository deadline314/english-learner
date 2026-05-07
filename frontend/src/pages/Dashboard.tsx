import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { Flame, BookOpen, MessageSquare, Sparkles, ArrowRight, X, Trophy, CalendarDays, Zap, Star } from 'lucide-react'
import { cn } from '../lib/utils'

interface DashboardData {
  todayProgress: { completed: number; total: number }
  streak: { currentStreak: number; longestStreak: number; lastActiveDate: string; totalDays: number }
  wordsDue: number; grammarDue: number; phrasesDue: number
  wordsNew: number; grammarNew: number; phrasesNew: number
  recentWrong: {
    id: number; itemType: string; itemId: number
    userAnswer: string; correctAnswer: string
    createdAt: number; mastered: boolean; word?: string
  }[]
  weeklyActivity: { date: string; count: number }[]
}

const STAGGER_DELAY = 0.1

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: STAGGER_DELAY },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? completed / total : 0
  const offset = circumference - progress * circumference

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r={radius}
          fill="none" stroke="hsl(var(--border))" strokeWidth="10"
        />
        <motion.circle
          cx="60" cy="60" r={radius}
          fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.4))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{completed}</span>
        <span className="text-xs text-muted-foreground">/ {total}</span>
      </div>
    </div>
  )
}

function StreakBadge({ streak, longest }: { streak: number; longest: number }) {
  return (
    <motion.div
      className="flex items-center gap-3 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 border border-border rounded-xl px-5 py-3"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <motion.div
        animate={streak > 0 ? { y: [0, -3, 0] } : {}}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
      >
        <Flame className="w-6 h-6 text-orange-500" />
      </motion.div>
      <div>
        <span className="font-bold text-lg text-foreground">{streak} day streak</span>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Trophy className="w-3 h-3" /> Best: {longest} days
        </p>
      </div>
    </motion.div>
  )
}

function WeeklyHeatmap({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
        <CalendarDays className="w-5 h-5 mr-2 opacity-40" />
        No activity this week yet
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      {data.map((day, i) => {
        const intensity = day.count / maxCount
        const weekday = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })
        return (
          <div key={day.date} className="flex flex-col items-center gap-1">
            <motion.div
              className={cn(
                'w-10 h-10 rounded-lg border border-border/50',
                day.count === 0 ? 'bg-muted' : ''
              )}
              style={day.count > 0 ? {
                backgroundColor: `rgba(16, 185, 129, ${0.2 + intensity * 0.8})`,
              } : undefined}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              title={`${day.date}: ${day.count} items`}
            />
            <span className="text-xs text-muted-foreground">{weekday}</span>
          </div>
        )
      })}
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-muted rounded-lg', className)} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <Skeleton className="h-10 w-64" />
      <div className="flex items-center gap-8">
        <Skeleton className="w-36 h-36 rounded-full" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

const PRACTICE_CARDS = [
  { key: 'words', label: 'Vocabulary', icon: BookOpen, color: 'indigo', route: '/practice/word' },
  { key: 'grammar', label: 'Grammar', icon: MessageSquare, color: 'emerald', route: '/practice/grammar' },
  { key: 'phrases', label: 'Phrases', icon: Sparkles, color: 'amber', route: '/practice/phrase' },
] as const

const COLOR_MAP: Record<string, { gradient: string; border: string; text: string; iconBg: string }> = {
  indigo: { gradient: 'from-indigo-500/10 to-indigo-600/5', border: 'border-border', text: 'text-indigo-500 dark:text-indigo-400', iconBg: 'bg-indigo-500/10' },
  emerald: { gradient: 'from-emerald-500/10 to-emerald-600/5', border: 'border-border', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10' },
  amber: { gradient: 'from-amber-500/10 to-amber-600/5', border: 'border-border', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-500/10' },
}

export default function Dashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/progress/dashboard'),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  if (isLoading || !data) return <LoadingSkeleton />

  const dueMap = { words: data.wordsDue, grammar: data.grammarDue, phrases: data.phrasesDue }
  const newMap = { words: data.wordsNew, grammar: data.grammarNew, phrases: data.phrasesNew }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <motion.div
        className="relative rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-6 overflow-hidden"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.06),transparent_50%)]" />
        <div className="relative">
          <h1 className="text-3xl font-bold text-foreground">{getGreeting()} 👋</h1>
          <p className="text-muted-foreground mt-1">{formatDate()}</p>
        </div>
      </motion.div>

      <motion.div
        className="flex flex-wrap items-center gap-8 bg-card border border-border rounded-xl p-6 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <ProgressRing
          completed={data.todayProgress.completed}
          total={data.todayProgress.total}
        />
        <div className="space-y-3">
          <StreakBadge streak={data.streak.currentStreak} longest={data.streak.longestStreak} />
          <p className="text-sm text-muted-foreground">
            Total active days: <span className="font-medium text-foreground">{data.streak.totalDays}</span>
          </p>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {PRACTICE_CARDS.map((card) => {
          const colors = COLOR_MAP[card.color]
          const Icon = card.icon
          const due = dueMap[card.key]
          const newCount = newMap[card.key]

          return (
            <motion.button
              key={card.key}
              className={cn(
                'relative p-5 rounded-xl border text-left bg-gradient-to-br shadow-sm',
                'hover:shadow-md cursor-pointer transition-shadow',
                colors.gradient, colors.border
              )}
              variants={itemVariants}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => navigate(card.route)}
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3 border border-border', colors.iconBg)}>
                <Icon className={cn('w-5 h-5', colors.text)} />
              </div>
              <h3 className={cn('font-semibold text-lg text-foreground')}>{card.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Due <span className="font-medium text-foreground">{due}</span> · New <span className="font-medium text-foreground">{newCount}</span>
              </p>
              <ArrowRight className={cn('absolute top-5 right-5 w-4 h-4 opacity-40', colors.text)} />
            </motion.button>
          )
        })}
      </motion.div>

      <motion.button
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate('/practice/mixed')}
      >
        Start Mixed Practice
      </motion.button>

      <motion.div
        className="grid grid-cols-2 gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <motion.button
          className="relative p-5 rounded-xl border text-left bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-400/30 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          onClick={() => navigate('/practice/toeic')}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 border border-amber-400/30 bg-amber-500/10">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">TOEIC 精選</h3>
          <p className="text-sm text-muted-foreground mt-1">1000 個高頻單字</p>
          <ArrowRight className="absolute top-5 right-5 w-4 h-4 opacity-40 text-amber-500" />
        </motion.button>

        <motion.button
          className="relative p-5 rounded-xl border text-left bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-400/20 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          onClick={() => navigate('/bookmarks')}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 border border-rose-400/30 bg-rose-500/10">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">我的收藏</h3>
          <p className="text-sm text-muted-foreground mt-1">看過 · 錯題</p>
          <ArrowRight className="absolute top-5 right-5 w-4 h-4 opacity-40 text-rose-400" />
        </motion.button>
      </motion.div>

      <motion.div
        className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-lg font-semibold text-foreground">This Week</h2>
        <WeeklyHeatmap data={data.weeklyActivity} />
      </motion.div>

      <motion.div
        className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-lg font-semibold text-foreground">Recent Mistakes</h2>
        {data.recentWrong.length > 0 ? (
          <div className="space-y-2">
            {data.recentWrong.slice(0, 5).map((item, i) => (
              <motion.div
                key={item.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.05 }}
              >
                <div className="flex items-center gap-3">
                  <X className="w-4 h-4 text-destructive" />
                  <div>
                    <p className="font-medium text-foreground">{item.word || item.correctAnswer}</p>
                    <p className="text-xs text-muted-foreground">
                      Your answer: <span className="text-destructive">{item.userAnswer}</span>
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground">{item.itemType}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            No mistakes yet — keep it up!
          </div>
        )}
      </motion.div>
    </div>
  )
}
