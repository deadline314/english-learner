import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import { Volume2, Check, X, ArrowRight, RotateCcw, Trophy, Clock, Target, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BookmarkStar } from '../components/BookmarkStar'
import { saveSession, loadSession, clearSession } from '../lib/session'

interface Word {
  wordId: number
  word: string
  phonetic: string
  partOfSpeech: string
  definitions: { 'zh-TW': string[]; en: string[] }
  analysis?: { prefix?: { text: string; meaning: string }; root?: { text: string; meaning: string }; suffix?: { text: string; meaning: string }; logic: string }
  collocation: string
  examples: { en: string; 'zh-TW': string }[]
  wordFamily: Record<string, string>
  secondaryMeaningNote?: string | null
  difficulty: number
  frequencyRank: number
  toeicRank?: number
}

type QuestionType = 'zh-to-en' | 'en-to-zh' | 'fill-blank' | 'listen'

const OPTIONS_COUNT = 4
const HIGH_ACCURACY_THRESHOLD = 0.8

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateOptions(items: Word[], currentIndex: number, getLabel: (w: Word) => string): string[] {
  const correct = getLabel(items[currentIndex])
  const others = items.filter((_, i) => i !== currentIndex).map(getLabel).filter(l => l !== correct)
  return shuffleArray([correct, ...shuffleArray(others).slice(0, OPTIONS_COUNT - 1)])
}

function createBlankSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const result = sentence.replace(new RegExp(`\\b${escaped}\\w*\\b`, 'i'), '______')
  if (result !== sentence) return result
  const idx = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (idx !== -1) {
    let end = idx + word.length
    while (end < sentence.length && /\w/.test(sentence[end])) end++
    return sentence.slice(0, idx) + '______' + sentence.slice(end)
  }
  return sentence
}

export default function PracticeToeic() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { speak, stop, isSpeaking } = useTTS()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [questionType, setQuestionType] = useState<QuestionType>('zh-to-en')
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [answers, setAnswers] = useState<{ itemId: number; itemType: string; correct: boolean; timeMs: number; userAnswer?: string }[]>([])
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [isComplete, setIsComplete] = useState(false)
  const [direction] = useState(1)
  const [autoPlayReady, setAutoPlayReady] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['practice', 'toeic'],
    queryFn: () => api.get<{ items: Word[]; sessionId: string; mode: string }>('/practice/today?mode=toeic'),
  })

  const submitMutation = useMutation({
    mutationFn: (payload: { sessionId: string; mode: string; answers: typeof answers }) =>
      api.post('/practice/submit', payload),
    onSuccess: () => {
      clearSession('toeic')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast('Practice submitted!', 'success')
    },
    onError: () => showToast('Failed to submit', 'error'),
  })

  const items = data?.items ?? []
  const currentWord = items[currentIndex]

  useEffect(() => {
    if (!data) return
    const saved = loadSession('toeic')
    if (saved && saved.sessionId === data.sessionId && saved.currentIndex > 0) {
      setCurrentIndex(saved.currentIndex)
      setAnswers(saved.answers || [])
    }
  }, [data])

  useEffect(() => {
    if (data && currentIndex > 0) {
      saveSession('toeic', { sessionId: data.sessionId, items: [], currentIndex, answers, mode: 'toeic', savedAt: Date.now() })
    }
  }, [currentIndex, answers, data])

  const TYPES: QuestionType[] = ['zh-to-en', 'en-to-zh', 'fill-blank', 'listen']

  useEffect(() => {
    if (items.length > 0) {
      stop()
      setQuestionType(TYPES[Math.floor(Math.random() * TYPES.length)])
      setQuestionStartTime(Date.now())
    }
  }, [currentIndex, items.length, stop])

  useEffect(() => {
    if (questionType === 'listen' && currentWord) setAutoPlayReady(true)
  }, [questionType, currentWord])

  const options = useMemo(() => {
    if (!currentWord || items.length < OPTIONS_COUNT) return []
    if (questionType === 'zh-to-en' || questionType === 'listen' || questionType === 'fill-blank')
      return generateOptions(items, currentIndex, w => w.word)
    return generateOptions(items, currentIndex, w => w.definitions['zh-TW'][0])
  }, [currentWord, currentIndex, items, questionType])

  const blankSentence = useMemo(() => {
    if (questionType !== 'fill-blank' || !currentWord) return ''
    return currentWord.examples[0] ? createBlankSentence(currentWord.examples[0].en, currentWord.word) : '______'
  }, [questionType, currentWord])

  const getCorrectAnswer = useCallback((): string => {
    if (!currentWord) return ''
    if (questionType === 'zh-to-en' || questionType === 'listen' || questionType === 'fill-blank') return currentWord.word
    return currentWord.definitions['zh-TW'][0]
  }, [currentWord, questionType])

  const handleAnswer = useCallback((answer: string) => {
    if (isCorrect !== null) return
    const correct = answer.toLowerCase().trim() === getCorrectAnswer().toLowerCase().trim()
    setSelectedAnswer(answer)
    setIsCorrect(correct)
    setShowDetails(true)
    setAnswers(prev => [...prev, { itemId: currentWord!.wordId, itemType: 'word', correct, timeMs: Date.now() - questionStartTime, userAnswer: answer }])
  }, [isCorrect, getCorrectAnswer, questionStartTime, currentWord])

  const handleNext = useCallback(() => {
    if (currentIndex >= items.length - 1) {
      setIsComplete(true)
      if (data?.sessionId) submitMutation.mutate({ sessionId: data.sessionId, mode: 'word', answers })
      return
    }
    stop()
    setCurrentIndex(i => i + 1)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setShowDetails(false)
    setAutoPlayReady(false)
  }, [currentIndex, items.length, data?.sessionId, answers, submitMutation, stop])

  useKeyboardShortcuts(useMemo(() => ({
    '1': () => options[0] && !showDetails && handleAnswer(options[0]),
    '2': () => options[1] && !showDetails && handleAnswer(options[1]),
    '3': () => options[2] && !showDetails && handleAnswer(options[2]),
    '4': () => options[3] && !showDetails && handleAnswer(options[3]),
    ' ': () => showDetails && handleNext(),
    'p': () => currentWord && speak(currentWord.word),
  }), [options, showDetails, handleAnswer, handleNext, currentWord, speak]), !isComplete)

  if (isLoading) return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="h-2 bg-primary/10 rounded-full animate-pulse" />
      <div className="h-64 bg-card border border-border rounded-2xl animate-pulse" />
      <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />)}</div>
    </div>
  )

  if (error) return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col items-center gap-4 pt-20">
      <X className="w-12 h-12 text-rose-400" />
      <p className="text-muted-foreground">載入失敗</p>
      <button onClick={() => refetch()} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2">
        <RotateCcw className="w-4 h-4" /> 重試
      </button>
    </div>
  )

  if (isComplete) {
    const correctCount = answers.filter(a => a.correct).length
    const accuracy = answers.length > 0 ? correctCount / answers.length : 0
    const totalTime = answers.reduce((sum, a) => sum + a.timeMs, 0)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto p-6 pt-20">
        {accuracy >= HIGH_ACCURACY_THRESHOLD && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div key={i} className="absolute w-3 h-3 rounded-full"
                style={{ backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'][i % 5], left: `${Math.random() * 100}%` }}
                initial={{ top: '-10%', rotate: 0 }} animate={{ top: '110%', rotate: Math.random() * 720 }}
                transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, ease: 'linear' }}
              />
            ))}
          </div>
        )}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-8 h-8 text-amber-500" />
            <Trophy className="w-16 h-16 text-primary" />
            <Zap className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-1">TOEIC 精選 1000</p>
            <h2 className="text-2xl font-bold text-foreground">練習完成！</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-primary/10 rounded-xl">
              <Target className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{correctCount}/{answers.length}</p>
              <p className="text-sm text-muted-foreground">答對</p>
            </div>
            <div className="p-4 bg-emerald-500/10 rounded-xl">
              <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{Math.round(accuracy * 100)}%</p>
              <p className="text-sm text-muted-foreground">正確率</p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{Math.round(totalTime / 1000)}s</p>
              <p className="text-sm text-muted-foreground">時間</p>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 font-medium">
            回首頁
          </button>
        </div>
      </motion.div>
    )
  }

  if (!currentWord) return null

  const cardEntrance = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: 'easeOut' as const } }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">TOEIC 精選</span>
        </div>
        <div className="flex-1 h-2 bg-amber-500/10 rounded-full overflow-hidden">
          <motion.div className="h-full bg-amber-500 rounded-full" initial={false}
            animate={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
        <span className="text-sm text-muted-foreground font-medium shrink-0">{currentIndex + 1}/{items.length}</span>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div key={currentIndex} custom={direction}
          initial={{ x: direction * 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: direction * -300, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }} className="space-y-4">

          <motion.div {...cardEntrance} className={cn(
            'bg-card rounded-2xl shadow-sm p-6 border transition-all duration-300',
            isCorrect === true && 'border-emerald-400 shadow-emerald-500/10',
            isCorrect === false && 'border-rose-400 shadow-rose-500/10',
            isCorrect === null && 'border-amber-400/30'
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
                  {questionType === 'zh-to-en' && '中文 → English'}
                  {questionType === 'en-to-zh' && 'English → 中文'}
                  {questionType === 'fill-blank' && 'Fill in the Blank'}
                  {questionType === 'listen' && 'Listening'}
                </span>
                {currentWord.toeicRank && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-400/30 rounded text-xs font-bold">
                    #{currentWord.toeicRank}
                  </span>
                )}
              </div>
              {(questionType !== 'listen' && questionType !== 'zh-to-en') || (questionType === 'zh-to-en' && isCorrect !== null) ? (
                <button onClick={() => speak(currentWord.word)}
                  className={cn('p-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-all', isSpeaking && 'animate-pulse ring-2 ring-amber-400/30')}>
                  <Volume2 className="w-5 h-5" />
                </button>
              ) : null}
            </div>

            <div className="text-center py-4">
              {questionType === 'zh-to-en' && <p className="text-2xl font-medium text-foreground">{currentWord.definitions['zh-TW'][0]}</p>}
              {questionType === 'en-to-zh' && (
                <div><p className="text-3xl font-bold text-foreground">{currentWord.word}</p>
                  <p className="text-muted-foreground mt-1">{currentWord.phonetic}</p></div>
              )}
              {questionType === 'fill-blank' && (
                <div className="space-y-2">
                  <p className="text-xl text-foreground leading-relaxed">{blankSentence}</p>
                  <p className="text-sm text-muted-foreground">選出適合填入空格的單字</p>
                </div>
              )}
              {questionType === 'listen' && (
                <div className="flex flex-col items-center gap-3">
                  <motion.button onClick={() => { speak(currentWord.word); setAutoPlayReady(false) }}
                    whileTap={{ scale: 0.9 }}
                    animate={autoPlayReady ? { scale: [1, 1.1, 1] } : {}}
                    transition={autoPlayReady ? { repeat: 2, duration: 0.5 } : {}}
                    className={cn('w-16 h-16 rounded-full flex items-center justify-center transition-all',
                      autoPlayReady ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20')}>
                    <Volume2 className="w-8 h-8" />
                  </motion.button>
                  <p className="text-sm text-muted-foreground">{autoPlayReady ? '按下播放聽取單字' : '再聽一次'}</p>
                </div>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {options.map((option, i) => (
              <motion.button key={option}
                whileHover={isCorrect === null ? { scale: 1.01 } : {}} whileTap={{ scale: 0.97 }}
                animate={isCorrect === false && selectedAnswer === option ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
                onClick={() => handleAnswer(option)} disabled={isCorrect !== null}
                className={cn(
                  'p-4 rounded-xl border text-left font-medium transition-all',
                  isCorrect === null && 'border-border bg-card hover:border-amber-400/50 hover:bg-amber-500/5',
                  isCorrect !== null && option === getCorrectAnswer() && 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  isCorrect === false && selectedAnswer === option && 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                  isCorrect !== null && option !== getCorrectAnswer() && selectedAnswer !== option && 'opacity-50'
                )}>
                <span className="text-xs text-muted-foreground mr-2">{i + 1}</span>{option}
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {isCorrect !== null && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 py-2">
                <div className="flex items-center justify-center gap-2">
                  {isCorrect
                    ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><Check className="w-6 h-6" /><span className="font-medium">Correct!</span></motion.div>
                    : <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><X className="w-6 h-6" /><span className="font-medium">Answer: {getCorrectAnswer()}</span></motion.div>
                  }
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDetails && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-xl font-bold text-foreground">{currentWord.word}</span>
                    <span className="text-muted-foreground">{currentWord.phonetic}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">{currentWord.partOfSpeech}</span>
                    {currentWord.toeicRank && (
                      <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-400/20 rounded font-bold">
                        TOEIC #{currentWord.toeicRank}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <BookmarkStar itemType="word" itemId={currentWord.wordId} bookmarkType="seen" label="看過" />
                    {isCorrect === false && <BookmarkStar itemType="word" itemId={currentWord.wordId} bookmarkType="wrong" label="錯題" />}
                  </div>
                </div>
                <div className="space-y-1">
                  {currentWord.definitions['zh-TW'].map((d, i) => <p key={i} className="text-foreground">{d}</p>)}
                </div>
                {currentWord.analysis && <p className="text-sm text-muted-foreground italic">{currentWord.analysis.logic}</p>}
                {currentWord.examples[0] && (
                  <div className="border-l-2 border-amber-400/40 pl-3 text-sm">
                    <p className="text-foreground">{currentWord.examples[0].en}</p>
                    <p className="text-muted-foreground">{currentWord.examples[0]['zh-TW']}</p>
                  </div>
                )}
                {currentWord.collocation && (
                  <p className="text-sm text-muted-foreground"><span className="font-medium">Collocation:</span> {currentWord.collocation}</p>
                )}
                {Object.keys(currentWord.wordFamily).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(currentWord.wordFamily).map(([pos, form]) => (
                      <span key={pos} className="text-xs px-2 py-1 bg-muted rounded border border-border">{pos}: {form}</span>
                    ))}
                  </div>
                )}
                <button onClick={handleNext} className="w-full mt-3 py-3 bg-amber-500 text-white rounded-xl hover:opacity-90 transition-all font-medium flex items-center justify-center gap-2">
                  {currentIndex < items.length - 1 ? (<>Next <ArrowRight className="w-4 h-4" /></>) : 'Finish'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      <p className="text-center text-xs text-muted-foreground">Keys: 1-4 select • Space next • P play audio</p>
    </div>
  )
}
