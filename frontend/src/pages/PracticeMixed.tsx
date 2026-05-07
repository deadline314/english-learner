import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import { Volume2, Check, X, ArrowRight, RotateCcw, Trophy, Clock, Target, BookOpen, MessageSquare, Type } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

interface GrammarQuestion {
  id: number
  topicId: number
  topicTitle: string
  questionType: 'multiple_choice' | 'fill_blank' | 'transform' | 'reorder'
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

interface Phrase {
  id: number
  phrase: string
  meaningZh: string
  meaningEn: string
  examples: { en: string; 'zh-TW': string }[]
  category: string
}

interface MixedItem {
  itemType: 'word' | 'grammar' | 'phrase'
  item: Word | GrammarQuestion | Phrase
}

interface PracticeResponse {
  items: MixedItem[]
  sessionId: string
}

interface Answer {
  itemType: string
  itemId: number
  correct: boolean
  timeMs: number
}

const HIGH_ACCURACY_THRESHOLD = 0.8
const OPTIONS_COUNT = 4

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function WordQuestion({ word, allWords, onAnswer, isAnswered, selectedAnswer, isCorrect }: {
  word: Word
  allWords: Word[]
  onAnswer: (answer: string) => void
  isAnswered: boolean
  selectedAnswer: string | null
  isCorrect: boolean | null
}) {
  const { speak, isSpeaking } = useTTS()
  const correctAnswer = word.definitions['zh-TW'][0]

  const options = useMemo(() => {
    const others = allWords
      .filter((w) => w.wordId !== word.wordId)
      .map((w) => w.definitions['zh-TW'][0])
      .filter((d) => d !== correctAnswer)
    return shuffleArray([correctAnswer, ...shuffleArray(others).slice(0, OPTIONS_COUNT - 1)])
  }, [word.wordId, allWords, correctAnswer])

  return (
    <div className="space-y-4">
      <div className={cn(
        'bg-card rounded-2xl shadow-sm p-6 border transition-all duration-300',
        isCorrect === true && 'border-emerald-400 shadow-emerald-500/10',
        isCorrect === false && 'border-rose-400 shadow-rose-500/10',
        isCorrect === null && 'border-border'
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" />
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">Vocabulary</span>
          </div>
          <button onClick={() => speak(word.word)} className={cn('p-2.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all', isSpeaking && 'animate-pulse ring-2 ring-primary/30')}>
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center py-4">
          <p className="text-3xl font-bold text-foreground">{word.word}</p>
          <p className="text-muted-foreground mt-1">{word.phonetic}</p>
          <p className="text-xs text-muted-foreground mt-1">Select the Chinese meaning</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((option, i) => (
          <motion.button
            key={`${option}-${i}`}
            whileHover={!isAnswered ? { scale: 1.01 } : {}}
            whileTap={{ scale: 0.97 }}
            animate={isCorrect === false && selectedAnswer === option ? { x: [0, -8, 8, -8, 8, 0] } : {}}
            transition={{ duration: 0.4 }}
            onClick={() => onAnswer(option)}
            disabled={isAnswered}
            className={cn(
              'p-4 rounded-xl border text-left font-medium transition-all',
              !isAnswered && 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
              isAnswered && option === correctAnswer && 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              isCorrect === false && selectedAnswer === option && 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300',
              isAnswered && option !== correctAnswer && selectedAnswer !== option && 'opacity-50'
            )}
          >
            <span className="text-xs text-muted-foreground mr-2">{i + 1}</span>
            {option}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function GrammarQuestionCard({ question, onAnswer, isAnswered, selectedAnswer, isCorrect }: {
  question: GrammarQuestion
  onAnswer: (answer: string) => void
  isAnswered: boolean
  selectedAnswer: string | null
  isCorrect: boolean | null
}) {
  const [textInput, setTextInput] = useState('')
  const isTextInput = question.questionType === 'fill_blank' || question.questionType === 'transform'

  return (
    <div className="space-y-4">
      <div className={cn(
        'bg-card rounded-2xl shadow-sm p-6 border transition-all duration-300',
        isCorrect === true && 'border-emerald-400 shadow-emerald-500/10',
        isCorrect === false && 'border-rose-400 shadow-rose-500/10',
        isCorrect === null && 'border-border'
      )}>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">Grammar</span>
          <span className="ml-auto text-xs text-muted-foreground">{question.topicTitle}</span>
        </div>
        <p className="text-lg text-foreground leading-relaxed">{question.question}</p>
      </div>

      {isTextInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && textInput.trim() && onAnswer(textInput.trim())}
            disabled={isAnswered}
            placeholder="Type your answer..."
            className="flex-1 px-4 py-3 border border-border bg-card text-foreground rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
          />
          <button
            onClick={() => textInput.trim() && onAnswer(textInput.trim())}
            disabled={isAnswered || !textInput.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
          >
            Submit
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {question.options.map((option, i) => (
            <motion.button
              key={option}
              whileHover={!isAnswered ? { scale: 1.01 } : {}}
              whileTap={{ scale: 0.98 }}
              animate={isCorrect === false && selectedAnswer === option ? { x: [0, -8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }}
              onClick={() => onAnswer(option)}
              disabled={isAnswered}
              className={cn(
                'w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3',
                !isAnswered && 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
                isAnswered && option === question.correctAnswer && 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                isCorrect === false && selectedAnswer === option && 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                isAnswered && option !== question.correctAnswer && selectedAnswer !== option && 'opacity-50'
              )}
            >
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">{i + 1}</span>
              <span className="font-medium">{option}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

function PhraseQuestion({ phrase, allPhrases, onAnswer, isAnswered, selectedAnswer, isCorrect }: {
  phrase: Phrase
  allPhrases: Phrase[]
  onAnswer: (answer: string) => void
  isAnswered: boolean
  selectedAnswer: string | null
  isCorrect: boolean | null
}) {
  const { speak, isSpeaking } = useTTS()
  const correctAnswer = phrase.meaningZh

  const options = useMemo(() => {
    const others = allPhrases
      .filter((p) => p.id !== phrase.id)
      .map((p) => p.meaningZh)
      .filter((m) => m !== correctAnswer)
    return shuffleArray([correctAnswer, ...shuffleArray(others).slice(0, OPTIONS_COUNT - 1)])
  }, [phrase.id, allPhrases, correctAnswer])

  return (
    <div className="space-y-4">
      <div className={cn(
        'bg-card rounded-2xl shadow-sm p-6 border transition-all duration-300',
        isCorrect === true && 'border-emerald-400 shadow-emerald-500/10',
        isCorrect === false && 'border-rose-400 shadow-rose-500/10',
        isCorrect === null && 'border-border'
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">Phrase</span>
          </div>
          <button onClick={() => speak(phrase.phrase)} className={cn('p-2.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all', isSpeaking && 'animate-pulse ring-2 ring-primary/30')}>
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center py-4">
          <p className="text-2xl font-bold text-foreground">{phrase.phrase}</p>
          <p className="text-xs text-muted-foreground mt-2">Select the Chinese meaning</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((option, i) => (
          <motion.button
            key={`${option}-${i}`}
            whileHover={!isAnswered ? { scale: 1.01 } : {}}
            whileTap={{ scale: 0.97 }}
            animate={isCorrect === false && selectedAnswer === option ? { x: [0, -8, 8, -8, 8, 0] } : {}}
            transition={{ duration: 0.4 }}
            onClick={() => onAnswer(option)}
            disabled={isAnswered}
            className={cn(
              'p-4 rounded-xl border text-left font-medium transition-all',
              !isAnswered && 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
              isAnswered && option === correctAnswer && 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              isCorrect === false && selectedAnswer === option && 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300',
              isAnswered && option !== correctAnswer && selectedAnswer !== option && 'opacity-50'
            )}
          >
            <span className="text-xs text-muted-foreground mr-2">{i + 1}</span>
            {option}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

export default function PracticeMixed() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [isComplete, setIsComplete] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['practice', 'mixed'],
    queryFn: () => api.get<PracticeResponse>('/practice/today?mode=mixed'),
  })

  const submitMutation = useMutation({
    mutationFn: (payload: { sessionId: string; mode: string; answers: Answer[] }) =>
      api.post('/practice/submit', payload),
    onSuccess: () => showToast('Practice submitted!', 'success'),
    onError: () => showToast('Failed to submit', 'error'),
  })

  const items = data?.items ?? []
  const currentItem = items[currentIndex]

  const allWords = useMemo(() => items.filter((i) => i.itemType === 'word').map((i) => i.item as Word), [items])
  const allPhrases = useMemo(() => items.filter((i) => i.itemType === 'phrase').map((i) => i.item as Phrase), [items])

  const getCorrectAnswer = useCallback((): string => {
    if (!currentItem) return ''
    if (currentItem.itemType === 'word') return (currentItem.item as Word).definitions['zh-TW'][0]
    if (currentItem.itemType === 'grammar') return (currentItem.item as GrammarQuestion).correctAnswer
    if (currentItem.itemType === 'phrase') return (currentItem.item as Phrase).meaningZh
    return ''
  }, [currentItem])

  const getItemId = useCallback((): number => {
    if (!currentItem) return 0
    if (currentItem.itemType === 'word') return (currentItem.item as Word).wordId
    if (currentItem.itemType === 'grammar') return (currentItem.item as GrammarQuestion).id
    return (currentItem.item as Phrase).id
  }, [currentItem])

  const handleAnswer = useCallback((answer: string) => {
    if (isCorrect !== null) return
    const correctAnswer = getCorrectAnswer()
    const correct = answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
    setSelectedAnswer(answer)
    setIsCorrect(correct)
    setShowDetails(true)
    const timeMs = Date.now() - questionStartTime
    setAnswers((prev) => [...prev, {
      itemType: currentItem!.itemType,
      itemId: getItemId(),
      correct,
      timeMs,
    }])
  }, [isCorrect, getCorrectAnswer, questionStartTime, currentItem, getItemId])

  const handleNext = useCallback(() => {
    if (currentIndex >= items.length - 1) {
      setIsComplete(true)
      if (data?.sessionId) {
        submitMutation.mutate({ sessionId: data.sessionId, mode: 'mixed', answers })
      }
      return
    }
    setCurrentIndex((i) => i + 1)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setShowDetails(false)
    setQuestionStartTime(Date.now())
  }, [currentIndex, items.length, data?.sessionId, answers, submitMutation])

  useKeyboardShortcuts(
    useMemo(() => ({
      ' ': () => showDetails && handleNext(),
    }), [showDetails, handleNext]),
    !isComplete
  )

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="h-2 bg-primary/10 rounded-full animate-pulse" />
        <div className="h-48 bg-card border border-border rounded-2xl shadow-sm animate-pulse" />
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
        <p className="text-muted-foreground">Failed to load mixed practice</p>
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
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center space-y-6">
          <Trophy className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Mixed Practice Complete!</h2>
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
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <span className="px-3 py-1 bg-primary/10 rounded-full text-primary">
              Words: {answers.filter((a) => a.itemType === 'word').filter((a) => a.correct).length}/{answers.filter((a) => a.itemType === 'word').length}
            </span>
            <span className="px-3 py-1 bg-purple-500/10 rounded-full text-purple-600 dark:text-purple-400">
              Grammar: {answers.filter((a) => a.itemType === 'grammar').filter((a) => a.correct).length}/{answers.filter((a) => a.itemType === 'grammar').length}
            </span>
            <span className="px-3 py-1 bg-pink-500/10 rounded-full text-pink-600 dark:text-pink-400">
              Phrases: {answers.filter((a) => a.itemType === 'phrase').filter((a) => a.correct).length}/{answers.filter((a) => a.itemType === 'phrase').length}
            </span>
          </div>
          <button onClick={() => navigate('/')} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-medium">
            Back to Dashboard
          </button>
        </div>
      </motion.div>
    )
  }

  if (!currentItem) return null

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" initial={false} animate={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
        <span className="text-sm text-muted-foreground font-medium">{currentIndex + 1}/{items.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="space-y-4"
        >
          {currentItem.itemType === 'word' && (
            <WordQuestion
              word={currentItem.item as Word}
              allWords={allWords}
              onAnswer={handleAnswer}
              isAnswered={isCorrect !== null}
              selectedAnswer={selectedAnswer}
              isCorrect={isCorrect}
            />
          )}
          {currentItem.itemType === 'grammar' && (
            <GrammarQuestionCard
              question={currentItem.item as GrammarQuestion}
              onAnswer={handleAnswer}
              isAnswered={isCorrect !== null}
              selectedAnswer={selectedAnswer}
              isCorrect={isCorrect}
            />
          )}
          {currentItem.itemType === 'phrase' && (
            <PhraseQuestion
              phrase={currentItem.item as Phrase}
              allPhrases={allPhrases}
              onAnswer={handleAnswer}
              isAnswered={isCorrect !== null}
              selectedAnswer={selectedAnswer}
              isCorrect={isCorrect}
            />
          )}

          <AnimatePresence>
            {isCorrect !== null && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 py-1">
                {isCorrect ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-5 h-5" /> <span className="font-medium">Correct!</span>
                  </motion.div>
                ) : (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <X className="w-5 h-5" /> <span className="font-medium">Answer: {getCorrectAnswer()}</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDetails && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                {currentItem.itemType === 'grammar' && (
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-sm">
                    <h4 className="font-semibold text-foreground">Explanation</h4>
                    <p className="text-muted-foreground leading-relaxed">{(currentItem.item as GrammarQuestion).explanation}</p>
                  </div>
                )}
                {currentItem.itemType === 'word' && (
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-sm">
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-bold text-foreground">{(currentItem.item as Word).word}</span>
                      <span className="text-muted-foreground">{(currentItem.item as Word).phonetic}</span>
                    </div>
                    {(currentItem.item as Word).definitions['zh-TW'].map((d, i) => (
                      <p key={i} className="text-foreground">{d}</p>
                    ))}
                    {(currentItem.item as Word).secondaryMeaningNote && (
                      <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-sm text-amber-700 dark:text-amber-300">{(currentItem.item as Word).secondaryMeaningNote}</p>
                      </div>
                    )}
                  </div>
                )}
                {currentItem.itemType === 'phrase' && (
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-2 shadow-sm">
                    <p className="font-bold text-foreground">{(currentItem.item as Phrase).phrase}</p>
                    <p className="text-muted-foreground">{(currentItem.item as Phrase).meaningEn}</p>
                    {(currentItem.item as Phrase).examples[0] && (
                      <div className="border-l-2 border-primary/30 pl-3 text-sm mt-2">
                        <p className="text-foreground">{(currentItem.item as Phrase).examples[0].en}</p>
                        <p className="text-muted-foreground">{(currentItem.item as Phrase).examples[0]['zh-TW']}</p>
                      </div>
                    )}
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
        Space to continue
      </p>
    </div>
  )
}
