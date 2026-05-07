import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Calendar, HelpCircle, CheckCircle, Flame, BarChart3, PieChart as PieChartIcon, Activity, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { useEffect, useState } from 'react'

interface StatsData {
  totalDays: number; totalAnswered: number; correctRate: number; currentStreak: number
  dailyActivity: { date: string; count: number; correct: number }[]
  typeDistribution: { type: string; count: number }[]
  srsDistribution: { level: number; count: number }[]
  hardestWords: { word: string; wrongCount: number }[]
}

const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
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

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 800
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [value])

  return <>{display}{suffix}</>
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-muted rounded-lg', className)} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

function EmptyChartPlaceholder({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground">
      <Icon className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

function HeatmapGrid({ data }: { data: { date: string; count: number }[] }) {
  const last90 = data.slice(-90)
  const maxCount = Math.max(...last90.map(d => d.count), 1)
  const weeks = Math.ceil(last90.length / 7)

  if (last90.length === 0) {
    return <EmptyChartPlaceholder icon={Calendar} message="No activity data yet" />
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, 14px)`, gridTemplateRows: 'repeat(7, 14px)' }}>
        {last90.map((day, i) => {
          const intensity = day.count / maxCount
          const col = Math.floor(i / 7)
          const row = i % 7
          return (
            <motion.div
              key={day.date}
              className="w-3.5 h-3.5 rounded-sm border border-border/50"
              style={{
                gridColumn: col + 1,
                gridRow: row + 1,
                backgroundColor: day.count === 0
                  ? 'hsl(var(--muted))'
                  : `rgba(79, 70, 229, ${0.15 + intensity * 0.85})`,
              }}
              title={`${day.date}: ${day.count}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.005 }}
            />
          )
        })}
      </div>
    </div>
  )
}

const OVERVIEW_CARDS = [
  { key: 'totalDays', label: 'Total Days', icon: Calendar, gradient: 'from-indigo-500/10 to-indigo-600/5' },
  { key: 'totalAnswered', label: 'Questions', icon: HelpCircle, gradient: 'from-emerald-500/10 to-emerald-600/5' },
  { key: 'correctRate', label: 'Correct Rate', icon: CheckCircle, gradient: 'from-amber-500/10 to-amber-600/5', suffix: '%' },
  { key: 'currentStreak', label: 'Streak', icon: Flame, gradient: 'from-rose-500/10 to-rose-600/5' },
] as const

const ICON_COLORS = ['text-indigo-500', 'text-emerald-500', 'text-amber-500', 'text-rose-500']

export default function Stats() {
  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: () => api.get('/progress/stats'),
  })

  if (isLoading) return <LoadingSkeleton />

  const hasActivity = data && data.dailyActivity.length > 0
  const hasTypeData = data && data.typeDistribution.length > 0
  const hasSrsData = data && data.srsDistribution.length > 0
  const hasHardestWords = data && data.hardestWords.length > 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <motion.h1
        className="text-3xl font-bold text-foreground"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Learning Statistics
      </motion.h1>

      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {OVERVIEW_CARDS.map((card, i) => {
          const Icon = card.icon
          const value = data?.[card.key] ?? 0

          return (
            <motion.div
              key={card.key}
              className={cn(
                'p-5 rounded-xl border border-border bg-gradient-to-br shadow-sm hover:shadow-md transition-shadow',
                card.gradient
              )}
              variants={itemVariants}
              whileHover={{ y: -2 }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-card border border-border">
                <Icon className={cn('w-4 h-4', ICON_COLORS[i])} />
              </div>
              <p className="text-2xl font-bold text-foreground">
                <AnimatedNumber value={value} suffix={'suffix' in card ? card.suffix : ''} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
            </motion.div>
          )
        })}
      </motion.div>

      <motion.div
        className="bg-card p-6 rounded-xl border border-border shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Daily Activity (Last 30 Days)</h2>
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.dailyActivity.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Line
                type="monotone" dataKey="count" name="Questions"
                stroke="#4F46E5" strokeWidth={2} dot={false}
              />
              <Line
                type="monotone" dataKey="correct" name="Correct"
                stroke="#10B981" strokeWidth={2} dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartPlaceholder icon={Activity} message="No activity data yet. Start practicing!" />
        )}
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        transition={{ delayChildren: 0.5 }}
      >
        <motion.div
          className="bg-card p-6 rounded-xl border border-border shadow-sm"
          variants={itemVariants}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">Type Distribution</h2>
          {hasTypeData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.typeDistribution}
                  dataKey="count"
                  nameKey="type"
                  cx="50%" cy="50%"
                  outerRadius={90}
                  label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.typeDistribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartPlaceholder icon={PieChartIcon} message="No type distribution data yet" />
          )}
        </motion.div>

        <motion.div
          className="bg-card p-6 rounded-xl border border-border shadow-sm"
          variants={itemVariants}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">SRS Level Distribution</h2>
          {hasSrsData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.srsDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="level"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => `Lv${v}`}
                />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.srsDistribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartPlaceholder icon={BarChart3} message="No SRS data yet" />
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="bg-card p-6 rounded-xl border border-border shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Hardest Words</h2>
        {hasHardestWords ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-sm font-medium text-muted-foreground">#</th>
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Word</th>
                  <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Wrong Count</th>
                </tr>
              </thead>
              <tbody>
                {data.hardestWords.slice(0, 10).map((item, i) => (
                  <motion.tr
                    key={item.word}
                    className="border-b border-border/50 last:border-0"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.04 }}
                  >
                    <td className="py-3 text-sm text-muted-foreground">{i + 1}</td>
                    <td className="py-3 font-medium text-foreground">{item.word}</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-destructive/10 text-destructive">
                        {item.wrongCount}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyChartPlaceholder icon={AlertTriangle} message="No mistakes recorded yet. Keep practicing!" />
        )}
      </motion.div>

      <motion.div
        className="bg-card p-6 rounded-xl border border-border shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Activity (Last 90 Days)</h2>
        <HeatmapGrid data={data?.dailyActivity ?? []} />
      </motion.div>
    </div>
  )
}
