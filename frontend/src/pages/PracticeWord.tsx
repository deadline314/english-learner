import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import { Volume2, Check, X, ArrowRight, RotateCcw, Trophy, Clock, Target, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { saveSession, loadSession, clearSession } from '../lib/session'

interface Word {
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

interface PracticeResponse {
  items: Word[]
  sessionId: string
}

interface Answer {
  itemId: number
  itemType: string
  correct: boolean
  timeMs: number
  userAnswer?: string
}

type QuestionType = 'zh-to-en' | 'en-to-zh' | 'fill-blank' | 'listen' | 'secondary-meaning'

const BASE_QUESTION_TYPES: QuestionType[] = ['zh-to-en', 'en-to-zh', 'fill-blank', 'listen']
const OPTIONS_COUNT = 4
const HIGH_ACCURACY_THRESHOLD = 0.8

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function generateOptions(items: Word[], currentIndex: number, getLabel: (w: Word) => string): string[] {
  const correct = getLabel(items[currentIndex])
  const others = items
    .filter((_, i) => i !== currentIndex)
    .map(getLabel)
    .filter((l) => l !== correct)
  const wrongOptions = shuffleArray(others).slice(0, OPTIONS_COUNT - 1)
  return shuffleArray([correct, ...wrongOptions])
}

function createBlankSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\w*\\b`, 'i')
  const result = sentence.replace(regex, '______')
  if (result === sentence) {
    const lower = sentence.toLowerCase()
    const idx = lower.indexOf(word.toLowerCase())
    if (idx !== -1) {
      let end = idx + word.length
      while (end < sentence.length && /\w/.test(sentence[end])) end++
      return sentence.slice(0, idx) + '______' + sentence.slice(end)
    }
    const words = sentence.split(' ')
    if (words.length > 3) {
      const mid = Math.floor(words.length / 2)
      words[mid] = '______'
      return words.join(' ')
    }
  }
  return result
}

const cardEntrance = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  'zh-to-en': '中 → 英',
  'en-to-zh': '英 → 中',
  'fill-blank': '填空',
  'listen': '聽力',
  'secondary-meaning': '次要意義',
}

export default function PracticeWord() {
  const navigate = useNavigate()
  const { speak, stop, isSpeaking } = useTTS()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [questionType, setQuestionType] = useState<QuestionType>('zh-to-en')
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [isComplete, setIsComplete] = useState(false)
  const [direction, setDirection] = useState(1)
  const [enabledTypes, setEnabledTypes] = useState<QuestionType[]>(BASE_QUESTION_TYPES)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [autoPlayReady, setAutoPlayReady] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['practice', 'word'],
    queryFn: () => api.get<PracticeResponse>('/practice/today?mode=word'),
  })

  const submitMutation = useMutation({
    mutationFn: (payload: { sessionId: string; mode: string; answers: Answer[] }) =>
      api.post('/practice/submit', payload),
    onSuccess: () => {
      clearSession('word')
      showToast('Practice submitted!', 'success')
    },
    onError: () => showToast('Failed to submit', 'error'),
  })

  const items = data?.items ?? []
  const currentWord = items[currentIndex]

  useEffect(() => {
    if (!data) return
    const saved = loadSession('word')
    if (saved && saved.sessionId === data.sessionId && saved.currentIndex > 0) {
      setCurrentIndex(saved.currentIndex)
      setAnswers(saved.answers || [])
    }
  }, [data])

  useEffect(() => {
    if (data && currentIndex > 0) {
      saveSession('word', {
        sessionId: data.sessionId,
        items: [],
        currentIndex,
        answers,
        mode: 'word',
        savedAt: Date.now(),
      })
    }
  }, [currentIndex, answers, data])

  useEffect(() => {
    if (items.length > 0) {
      stop()
      const word = items[currentIndex]
      const pool: QuestionType[] = word?.secondaryMeaningNote
        ? [...enabledTypes, 'secondary-meaning']
        : enabledTypes
      setQuestionType(pool[Math.floor(Math.random() * pool.length)])
      setQuestionStartTime(Date.now())
    }
  }, [currentIndex, items.length, enabledTypes, stop])

  useEffect(() => {
    if (questionType === 'listen' && currentWord) {
      setAutoPlayReady(true)
    }
  }, [questionType, currentWord])
  const options = useMemo(() => {
    if (!currentWord || items.length < OPTIONS_COUNT) return []
    if (questionType === 'zh-to-en' || questionType === 'listen' || questionType === 'fill-blank') {
      return generateOptions(items, currentIndex, (w) => w.word)
    }
    if (questionType === 'en-to-zh') {
      return generateOptions(items, currentIndex, (w) => w.definitions['zh-TW'][0])
    }
    if (questionType === 'secondary-meaning') {
      const correct = currentWord.definitions['zh-TW'].slice(-1)[0]
      const others = items
        .filter((_, i) => i !== currentIndex)
        .map((w) => w.definitions['zh-TW'][0])
        .filter((l) => l !== correct)
      return shuffleArray([correct, ...shuffleArray(others).slice(0, OPTIONS_COUNT - 1)])
    }
    return []
  }, [currentWord, currentIndex, items, questionType])

  const blankSentence = useMemo(() => {
    if (questionType !== 'fill-blank' || !currentWord) return ''
    const example = currentWord.examples[0]
    if (!example) return `______ is the word you need to find.`
    return createBlankSentence(example.en, currentWord.word)
  }, [questionType, currentWord])

  const getCorrectAnswer = useCallback((): string => {
    if (!currentWord) return ''
    if (questionType === 'zh-to-en' || questionType === 'listen' || questionType === 'fill-blank') return currentWord.word
    if (questionType === 'en-to-zh') return currentWord.definitions['zh-TW'][0]
    if (questionType === 'secondary-meaning') return currentWord.definitions['zh-TW'].slice(-1)[0]
    return ''
  }, [currentWord, questionType])

  const getSelectedWordInfo = useCallback((): { word: string; definition: string } | null => {
    if (!selectedAnswer || isCorrect !== false) return null
    if (questionType === 'zh-to-en' || questionType === 'listen' || questionType === 'fill-blank') {
      const found = items.find((w) => w.word === selectedAnswer)
      if (found) return { word: found.word, definition: found.definitions['zh-TW'][0] }
    }
    if (questionType === 'en-to-zh' || questionType === 'secondary-meaning') {
      const found = items.find((w) => w.definitions['zh-TW'][0] === selectedAnswer)
      if (found) return { word: found.word, definition: selectedAnswer }
    }
    return null
  }, [selectedAnswer, isCorrect, questionType, items])

  const handleAnswer = useCallback((answer: string) => {
    if (isCorrect !== null) return
    const correct = answer.toLowerCase().trim() === getCorrectAnswer().toLowerCase().trim()
    setSelectedAnswer(answer)
    setIsCorrect(correct)
    setShowDetails(true)
    const timeMs = Date.now() - questionStartTime
    setAnswers((prev) => [...prev, {
      itemId: currentWord!.wordId,
      itemType: 'word',
      correct,
      timeMs,
      userAnswer: answer,
    }])
  }, [isCorrect, getCorrectAnswer, questionStartTime, currentWord, questionType])

  const handleNext = useCallback(() => {
    if (currentIndex >= items.length - 1) {
      setIsComplete(true)
      if (data?.sessionId) {
        submitMutation.mutate({ sessionId: data.sessionId, mode: 'word', answers })
      }
      return
    }
    stop()
    setDirection(1)
    setCurrentIndex((i) => i + 1)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setShowDetails(false)
    setAutoPlayReady(false)
  }, [currentIndex, items.length, data?.sessionId, answers, submitMutation, stop])

  useKeyboardShortcuts(
    useMemo(() => ({
      '1': () => options[0] && !showDetails && handleAnswer(options[0]),
      '2': () => options[1] && !showDetails && handleAnswer(options[1]),
      '3': () => options[2] && !showDetails && handleAnswer(options[2]),
      '4': () => options[3] && !showDetails && handleAnswer(options[3]),
      ' ': () => showDetails && handleNext(),
      'p': () => currentWord && questionType !== 'listen' && !(questionType === 'zh-to-en' && isCorrect === null) && speak(currentWord.word),
    }), [options, showDetails, handleAnswer, handleNext, currentWord, speak, questionType, isCorrect]),
    !isComplete
  )

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="h-2 bg-primary/10 rounded-full animate-pulse" />
        <div className="h-64 bg-card border border-border rounded-2xl shadow-sm animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center gap-4 pt-20">
        <X className="w-12 h-12 text-rose-400" />
        <p className="text-muted-foreground">Failed to load practice session</p>
        <button onClick={() => refetch()} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  if (isComplete) {
    const correctCount = answers.filter((a) => a.correct).length
    const accuracy = answers.length > 0 ? correctCount / answers.length : 0
    const totalTime = answers.reduce((sum, a) => sum + a.timeMs, 0)
    const showConfetti = accuracy >= HIGH_ACCURACY_THRESHOLD

    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto p-6 pt-20">
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i % 5], left: `${Math.random() * 100}%` }}
                initial={{ top: '-10%', rotate: 0 }}
                animate={{ top: '110%', rotate: Math.random() * 720 }}
                transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, ease: 'linear' }}
              />
            ))}
          </div>
        )}
        <motion.div {...cardEntrance} className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center space-y-6">
          <Trophy className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Practice Complete!</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-primary/10 rounded-xl">
              <Target className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{correctCount}/{answers.length}</p>
              <p className="text-sm text-muted-foreground">Correct</p>
            </div>
            <div className="p-4 bg-emerald-500/10 rounded-xl">
              <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{Math.round(accuracy * 100)}%</p>
              <p className="text-sm text-muted-foreground">Accuracy</p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{Math.round(totalTime / 1000)}s</p>
              <p className="text-sm text-muted-foreground">Time</p>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-medium">
            Back to Dashboard
          </button>
        </motion.div>
      </motion.div>
    )
  }

  if (!currentWord) return null

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" initial={false} animate={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
        <span className="text-sm text-muted-foreground font-medium">{currentIndex + 1}/{items.length}</span>
        <button
          onClick={() => setShowTypeSelector(!showTypeSelector)}
          className={cn(
            'p-2 rounded-lg transition-all',
            showTypeSelector ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showTypeSelector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">題型選擇</p>
              <div className="flex flex-wrap gap-2">
                {BASE_QUESTION_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setEnabledTypes((prev) =>
                        prev.includes(type)
                          ? prev.length > 1 ? prev.filter((t) => t !== type) : prev
                          : [...prev, type]
                      )
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      enabledTypes.includes(type)
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {QUESTION_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">至少選擇一種題型</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          initial={{ x: direction * 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -300, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="space-y-4"
        >
          <motion.div {...cardEntrance} className={cn(
            'bg-card rounded-2xl shadow-sm p-6 border transition-all duration-300',
            isCorrect === true && 'border-emerald-400 shadow-emerald-500/10',
            isCorrect === false && 'border-rose-400 shadow-rose-500/10',
            isCorrect === null && 'border-border'
          )}>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {questionType === 'zh-to-en' && '中文 → English'}
                {questionType === 'en-to-zh' && 'English → 中文'}
                {questionType === 'fill-blank' && 'Fill in the Blank'}
                {questionType === 'listen' && 'Listening'}
                {questionType === 'secondary-meaning' && '⚡ 次要意義'}
              </span>
              {(questionType !== 'listen' && questionType !== 'zh-to-en') || (questionType === 'zh-to-en' && isCorrect !== null) ? (
                <button
                  onClick={() => speak(currentWord.word)}
                  className={cn(
                    'p-2.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all',
                    isSpeaking && 'animate-pulse ring-2 ring-primary/30'
                  )}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              ) : null}
            </div>

            <div className="text-center py-4">
              {questionType === 'zh-to-en' && (
                <p className="text-2xl font-medium text-foreground">{currentWord.definitions['zh-TW'][0]}</p>
              )}
              {questionType === 'en-to-zh' && (
                <div>
                  <p className="text-3xl font-bold text-foreground">{currentWord.word}</p>
                  <p className="text-muted-foreground mt-1">{currentWord.phonetic}</p>
                </div>
              )}
              {questionType === 'fill-blank' && (
                <div className="space-y-2">
                  <p className="text-xl text-foreground leading-relaxed">{blankSentence}</p>
                  <p className="text-sm text-muted-foreground">選出適合填入空格的單字</p>
                </div>
              )}
              {questionType === 'listen' && (
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    onClick={() => { speak(currentWord.word); setAutoPlayReady(false) }}
                    whileTap={{ scale: 0.9 }}
                    animate={autoPlayReady ? { scale: [1, 1.1, 1] } : {}}
                    transition={autoPlayReady ? { repeat: 2, duration: 0.5 } : {}}
                    className={cn(
                      'w-16 h-16 rounded-full flex items-center justify-center transition-all',
                      autoPlayReady
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                    )}
                  >
                    <Volume2 className="w-8 h-8" />
                  </motion.button>
                  <p className="text-sm text-muted-foreground">
                    {autoPlayReady ? '按下播放聽取單字' : '再聽一次'}
                  </p>
                </div>
              )}
              {questionType === 'secondary-meaning' && (
                <div className="space-y-3 text-left">
                  <p className="text-2xl font-bold text-foreground text-center">{currentWord.word}</p>
                  <p className="text-sm text-muted-foreground text-center">{currentWord.phonetic}</p>
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-medium mb-1">⚠️ 這個字有不常見的次要意義，請選出正確的解釋：</p>
                    <p className="text-xs text-muted-foreground">常見意義：{currentWord.definitions['zh-TW'][0]}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {options.map((option, i) => (
              <motion.button
                key={option}
                whileHover={isCorrect === null ? { scale: 1.01 } : {}}
                whileTap={{ scale: 0.97 }}
                animate={isCorrect === false && selectedAnswer === option ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
                onClick={() => handleAnswer(option)}
                disabled={isCorrect !== null}
                className={cn(
                  'p-4 rounded-xl border text-left font-medium transition-all',
                  isCorrect === null && 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
                  isCorrect !== null && option === getCorrectAnswer() && 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  isCorrect === false && selectedAnswer === option && 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                  isCorrect !== null && option !== getCorrectAnswer() && selectedAnswer !== option && 'opacity-50'
                )}
              >
                <span className="text-xs text-muted-foreground mr-2">{i + 1}</span>
                {option}
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {isCorrect !== null && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 py-2">
                <div className="flex items-center justify-center gap-2">
                  {isCorrect ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="w-6 h-6" /> <span className="font-medium">Correct!</span>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <X className="w-6 h-6" /> <span className="font-medium">Answer: {getCorrectAnswer()}</span>
                    </motion.div>
                  )}
                </div>
                {isCorrect === false && getSelectedWordInfo() && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-3 bg-rose-500/5 border border-rose-400/20 rounded-xl text-sm"
                  >
                    {(questionType === 'zh-to-en' || questionType === 'listen' || questionType === 'fill-blank') && (
                      <>
                        <p className="text-muted-foreground">
                          你選的 <span className="font-medium text-rose-600 dark:text-rose-400">{getSelectedWordInfo()!.word}</span> 的意思是：
                        </p>
                        <p className="text-foreground font-medium mt-1">{getSelectedWordInfo()!.definition}</p>
                      </>
                    )}
                    {(questionType === 'en-to-zh' || questionType === 'secondary-meaning') && (
                      <>
                        <p className="text-muted-foreground">
                          你選的「<span className="font-medium text-rose-600 dark:text-rose-400">{selectedAnswer}</span>」其實是：
                        </p>
                        <p className="text-foreground font-medium mt-1">{getSelectedWordInfo()!.word}</p>
                      </>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDetails && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden shadow-sm">
                <div className="flex items-baseline gap-3">
                  <span className="text-xl font-bold text-foreground">{currentWord.word}</span>
                  <span className="text-muted-foreground">{currentWord.phonetic}</span>
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">{currentWord.partOfSpeech}</span>
                </div>
                <div className="space-y-1">
                  {currentWord.definitions['zh-TW'].map((d, i) => (
                    <p key={i} className="text-foreground">{d}</p>
                  ))}
                </div>
                {currentWord.analysis && (
                  <div className="text-sm text-muted-foreground">
                    <p className="italic">{currentWord.analysis.logic}</p>
                  </div>
                )}
                {currentWord.examples[0] && (
                  <div className="border-l-2 border-primary/30 pl-3 text-sm">
                    <p className="text-foreground">{currentWord.examples[0].en}</p>
                    <p className="text-muted-foreground">{currentWord.examples[0]['zh-TW']}</p>
                  </div>
                )}
                {currentWord.collocation && (
                  <p className="text-sm text-muted-foreground"><span className="font-medium">Collocation:</span> {currentWord.collocation}</p>
                )}
                {currentWord.secondaryMeaningNote && (
                  <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-medium mb-1">⚡ 次要意義提醒</p>
                    <p>{currentWord.secondaryMeaningNote}</p>
                  </div>
                )}
                {Object.keys(currentWord.wordFamily).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(currentWord.wordFamily).map(([pos, form]) => (
                      <span key={pos} className="text-xs px-2 py-1 bg-card rounded border border-border">{pos}: {form}</span>
                    ))}
                  </div>
                )}
                <button onClick={handleNext} className="w-full mt-3 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-medium flex items-center justify-center gap-2">
                  {currentIndex < items.length - 1 ? (<>Next <ArrowRight className="w-4 h-4" /></>) : 'Finish'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      <p className="text-center text-xs text-muted-foreground">
        Keys: 1-4 select • Space next • P play audio
      </p>
    </div>
  )
}
