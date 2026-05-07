import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import { Volume2, Check, X, ArrowRight, Trophy, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BookmarkStar } from '../components/BookmarkStar'

interface Phrase {
  id: number
  phrase: string
  meaningZh: string
  meaningEn: string
  examples: { en: string; 'zh-TW': string }[]
  category: string
}

interface PhraseAnswer {
  itemId: number
  itemType: 'phrase'
  correct: boolean
  timeMs: number
  userAnswer: string
}

export default function PracticePhrase() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { speak, isSpeaking } = useTTS()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<PhraseAnswer[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [questionStart, setQuestionStart] = useState(Date.now())
  const [isComplete, setIsComplete] = useState(false)
  const [questionType, setQuestionType] = useState<'meaning' | 'complete'>('meaning')

  const { data, isLoading, error } = useQuery({
    queryKey: ['practice', 'phrase'],
    queryFn: () => api.get<{ items: Phrase[]; sessionId: string }>('/practice/today?mode=phrase'),
  })

  const submitMutation = useMutation({
    mutationFn: (payload: any) => api.post('/practice/submit', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast('練習結果已儲存', 'success')
    },
  })

  const items = data?.items || []
  const currentItem = items[currentIndex]

  useEffect(() => {
    if (currentItem) {
      setQuestionType(Math.random() > 0.5 ? 'meaning' : 'complete')
      setQuestionStart(Date.now())
    }
  }, [currentIndex, currentItem])

  const generateOptions = useCallback((correct: string, allItems: Phrase[], type: 'meaning' | 'complete'): string[] => {
    const options = [correct]
    const others = allItems.filter((p) => {
      if (type === 'meaning') return p.meaningZh !== correct
      return p.phrase !== correct
    })
    while (options.length < 4 && others.length > 0) {
      const idx = Math.floor(Math.random() * others.length)
      const val = type === 'meaning' ? others[idx].meaningZh : others[idx].phrase
      if (!options.includes(val)) options.push(val)
      others.splice(idx, 1)
    }
    return options.sort(() => Math.random() - 0.5)
  }, [])

  const getOptions = useCallback((): string[] => {
    if (!currentItem || items.length === 0) return []
    if (questionType === 'meaning') {
      return generateOptions(currentItem.meaningZh, items, 'meaning')
    }
    return generateOptions(currentItem.phrase, items, 'complete')
  }, [currentItem, items, questionType, generateOptions])

  const [options, setOptions] = useState<string[]>([])

  useEffect(() => {
    if (currentItem) {
      setOptions(getOptions())
    }
  }, [currentIndex, questionType, currentItem])

  const handleAnswer = (answer: string) => {
    if (showResult) return
    setSelectedOption(answer)
    setShowResult(true)

    const correctAnswer = questionType === 'meaning' ? currentItem.meaningZh : currentItem.phrase
    const isCorrect = answer === correctAnswer

    setAnswers((prev) => [...prev, {
      itemId: currentItem.id,
      itemType: 'phrase',
      correct: isCorrect,
      timeMs: Date.now() - questionStart,
      userAnswer: answer,
    }])
  }

  const handleNext = () => {
    if (currentIndex >= items.length - 1) {
      setIsComplete(true)
      if (data?.sessionId) {
        submitMutation.mutate({
          sessionId: data.sessionId,
          mode: 'phrase',
          answers,
        })
      }
      return
    }
    setCurrentIndex((i) => i + 1)
    setSelectedOption(null)
    setShowResult(false)
  }

  useKeyboardShortcuts({
    '1': () => !showResult && options[0] && handleAnswer(options[0]),
    '2': () => !showResult && options[1] && handleAnswer(options[1]),
    '3': () => !showResult && options[2] && handleAnswer(options[2]),
    '4': () => !showResult && options[3] && handleAnswer(options[3]),
    ' ': () => showResult && handleNext(),
    'p': () => currentItem && speak(currentItem.phrase),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse space-y-4 w-full max-w-lg">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-40 bg-muted rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-muted rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">{error ? '載入失敗' : '今天沒有片語要練習'}</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
          返回首頁
        </button>
      </div>
    )
  }

  if (isComplete) {
    const correct = answers.filter(a => a.correct).length
    const rate = Math.round((correct / answers.length) * 100)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <Trophy size={64} className={cn("text-warning", rate >= 80 && "text-success")} />
          {rate >= 80 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ delay: 0.3 }} className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full flex items-center justify-center">
              <Check size={14} className="text-white" />
            </motion.div>
          )}
        </div>
        <h2 className="text-2xl font-bold">練習完成！</h2>
        <div className="text-center space-y-1">
          <p className="text-4xl font-bold text-primary">{rate}%</p>
          <p className="text-muted-foreground">答對 {correct} / {answers.length} 題</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium">返回首頁</button>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2">
            <RotateCcw size={16} /> 再練一次
          </button>
        </div>
      </motion.div>
    )
  }

  const correctAnswer = questionType === 'meaning' ? currentItem.meaningZh : currentItem.phrase

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-sm text-muted-foreground font-medium">{currentIndex + 1}/{items.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {questionType === 'meaning' ? '選出正確中文意思' : '選出正確的片語'}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{currentItem.category}</span>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <h2 className="text-2xl font-bold">
                {questionType === 'meaning' ? currentItem.phrase : currentItem.meaningZh}
              </h2>
              <button
                onClick={() => speak(currentItem.phrase)}
                className={cn("p-2.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all", isSpeaking && "animate-pulse ring-2 ring-primary/30")}
              >
                <Volume2 size={20} />
              </button>
            </div>
            {questionType === 'meaning' && (
              <p className="text-sm text-muted-foreground mt-1">{currentItem.meaningEn}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((option, i) => {
              const isCorrectOption = option === correctAnswer
              const isSelected = option === selectedOption
              return (
                <motion.button
                  key={`${currentIndex}-${i}`}
                  whileHover={!showResult ? { scale: 1.01 } : {}}
                  whileTap={!showResult ? { scale: 0.98 } : {}}
                  onClick={() => handleAnswer(option)}
                  disabled={showResult}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all duration-200 relative",
                    !showResult && "hover:border-primary hover:shadow-md cursor-pointer border-border",
                    showResult && isCorrectOption && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
                    showResult && isSelected && !isCorrectOption && "border-rose-500 bg-rose-50 dark:bg-rose-900/20",
                    showResult && !isSelected && !isCorrectOption && "opacity-50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="font-medium text-sm">{option}</span>
                  </div>
                  {showResult && isCorrectOption && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2">
                      <Check size={18} className="text-emerald-600" />
                    </motion.div>
                  )}
                  {showResult && isSelected && !isCorrectOption && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2">
                      <X size={18} className="text-rose-600" />
                    </motion.div>
                  )}
                </motion.button>
              )
            })}
          </div>

          {showResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="bg-card rounded-xl p-5 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{currentItem.phrase}</h3>
                  <div className="flex items-center gap-1">
                    <BookmarkStar itemType="phrase" itemId={currentItem.id} bookmarkType="seen" label="看過" />
                    {selectedOption !== correctAnswer && (
                      <BookmarkStar itemType="phrase" itemId={currentItem.id} bookmarkType="wrong" label="錯題" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{currentItem.meaningZh} — {currentItem.meaningEn}</p>
                {currentItem.examples.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    {currentItem.examples.map((ex, i) => (
                      <div key={i} className="text-sm space-y-0.5">
                        <p className="font-serif text-foreground">{ex.en}</p>
                        <p className="text-muted-foreground">{ex['zh-TW']}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleNext}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                {currentIndex < items.length - 1 ? (<>下一題 <ArrowRight size={16} /></>) : '完成'}
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
