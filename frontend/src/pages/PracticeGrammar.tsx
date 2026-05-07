import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import { Check, X, ArrowRight, RotateCcw, Trophy, Clock, Target, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

interface PracticeResponse {
  items: GrammarQuestion[]
  sessionId: string
}

interface Answer {
  itemId: number
  itemType: string
  correct: boolean
  timeMs: number
  userAnswer?: string
}

const HIGH_ACCURACY_THRESHOLD = 0.8

const cardEntrance = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
}

export default function PracticeGrammar() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [textInput, setTextInput] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [direction] = useState(1)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['practice', 'grammar'],
    queryFn: () => api.get<PracticeResponse>('/practice/today?mode=grammar'),
  })

  const submitMutation = useMutation({
    mutationFn: (payload: { sessionId: string; mode: string; answers: Answer[] }) =>
      api.post('/practice/submit', payload),
    onSuccess: () => showToast('Practice submitted!', 'success'),
    onError: () => showToast('Failed to submit', 'error'),
  })

  const items = data?.items ?? []
  const currentQuestion = items[currentIndex]

  const handleAnswer = useCallback((answer: string) => {
    if (isCorrect !== null) return
    const correct = answer.trim().toLowerCase() === currentQuestion!.correctAnswer.trim().toLowerCase()
    setSelectedAnswer(answer)
    setIsCorrect(correct)
    setShowExplanation(true)
    const timeMs = Date.now() - questionStartTime
    setAnswers((prev) => [...prev, { itemId: currentQuestion!.id, itemType: 'grammar', correct, timeMs, userAnswer: answer }])
  }, [isCorrect, currentQuestion, questionStartTime])

  const handleNext = useCallback(() => {
    if (currentIndex >= items.length - 1) {
      setIsComplete(true)
      if (data?.sessionId) {
        submitMutation.mutate({ sessionId: data.sessionId, mode: 'grammar', answers })
      }
      return
    }
    setCurrentIndex((i) => i + 1)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setShowExplanation(false)
    setTextInput('')
    setQuestionStartTime(Date.now())
  }, [currentIndex, items.length, data?.sessionId, answers, submitMutation])

  const handleTextSubmit = useCallback(() => {
    if (textInput.trim()) handleAnswer(textInput.trim())
  }, [textInput, handleAnswer])

  useKeyboardShortcuts(
    useMemo(() => ({
      '1': () => currentQuestion?.options[0] && !showExplanation && currentQuestion.questionType === 'multiple_choice' && handleAnswer(currentQuestion.options[0]),
      '2': () => currentQuestion?.options[1] && !showExplanation && currentQuestion.questionType === 'multiple_choice' && handleAnswer(currentQuestion.options[1]),
      '3': () => currentQuestion?.options[2] && !showExplanation && currentQuestion.questionType === 'multiple_choice' && handleAnswer(currentQuestion.options[2]),
      '4': () => currentQuestion?.options[3] && !showExplanation && currentQuestion.questionType === 'multiple_choice' && handleAnswer(currentQuestion.options[3]),
      ' ': () => showExplanation && handleNext(),
    }), [currentQuestion, showExplanation, handleAnswer, handleNext]),
    !isComplete
  )

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="h-2 bg-primary/10 rounded-full animate-pulse" />
        <div className="h-48 bg-card border border-border rounded-2xl shadow-sm animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center gap-4 pt-20">
        <X className="w-12 h-12 text-rose-400" />
        <p className="text-muted-foreground">Failed to load grammar practice</p>
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
          <h2 className="text-2xl font-bold text-foreground">Grammar Practice Complete!</h2>
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

  if (!currentQuestion) return null

  const isTextInput = currentQuestion.questionType === 'fill_blank' || currentQuestion.questionType === 'transform'

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" initial={false} animate={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
        <span className="text-sm text-muted-foreground font-medium">{currentIndex + 1}/{items.length}</span>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="space-y-4"
        >
          <motion.div {...cardEntrance} className={cn(
            'bg-card rounded-2xl shadow-sm p-6 border transition-all duration-300',
            isCorrect === true && 'border-emerald-400 shadow-emerald-500/10',
            isCorrect === false && 'border-rose-400 shadow-rose-500/10',
            isCorrect === null && 'border-border'
          )}>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary">{currentQuestion.topicTitle}</span>
              <span className="ml-auto px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                {currentQuestion.questionType.replace('_', ' ')}
              </span>
            </div>
            <p className="text-lg text-foreground leading-relaxed">{currentQuestion.question}</p>
          </motion.div>

          {isTextInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                disabled={isCorrect !== null}
                placeholder="Type your answer..."
                className="flex-1 px-4 py-3 border border-border bg-card text-foreground rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
              />
              <button
                onClick={handleTextSubmit}
                disabled={isCorrect !== null || !textInput.trim()}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
              >
                Submit
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {currentQuestion.options.map((option, i) => (
                <motion.button
                  key={option}
                  whileHover={isCorrect === null ? { scale: 1.01 } : {}}
                  whileTap={{ scale: 0.98 }}
                  animate={isCorrect === false && selectedAnswer === option ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  onClick={() => handleAnswer(option)}
                  disabled={isCorrect !== null}
                  className={cn(
                    'w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3',
                    isCorrect === null && 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
                    isCorrect !== null && option === currentQuestion.correctAnswer && 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                    isCorrect === false && selectedAnswer === option && 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                    isCorrect !== null && option !== currentQuestion.correctAnswer && selectedAnswer !== option && 'opacity-50'
                  )}
                >
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">{i + 1}</span>
                  <span className="font-medium">{option}</span>
                </motion.button>
              ))}
            </div>
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
                    <X className="w-5 h-5" /> <span className="font-medium">Answer: {currentQuestion.correctAnswer}</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showExplanation && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden shadow-sm">
                <h4 className="font-semibold text-foreground">Explanation</h4>
                <p className="text-muted-foreground leading-relaxed">{currentQuestion.explanation}</p>
                <button onClick={handleNext} className="w-full mt-3 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-medium flex items-center justify-center gap-2">
                  {currentIndex < items.length - 1 ? (<>Next <ArrowRight className="w-4 h-4" /></>) : 'Finish'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      <p className="text-center text-xs text-muted-foreground">
        Keys: 1-4 select • Space next
      </p>
    </div>
  )
}
