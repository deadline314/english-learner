import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import {
  GraduationCap, Rocket, Target, Globe,
  BookOpen, Briefcase, PenTool, Trophy,
  ChevronRight, ChevronLeft, SkipForward,
} from 'lucide-react'

const STEPS = ['Level', 'Daily Goal', 'Purpose', 'Accent']

const LEVELS = [
  { id: 'beginner', label: 'Beginner', desc: 'Just starting out', icon: BookOpen },
  { id: 'intermediate', label: 'Intermediate', desc: 'Can hold conversations', icon: GraduationCap },
  { id: 'upper-intermediate', label: 'Upper Intermediate', desc: 'Comfortable in most situations', icon: Rocket },
  { id: 'advanced', label: 'Advanced', desc: 'Near-native fluency', icon: Trophy },
]

const GOALS = [
  { id: 10, label: '10 words', desc: 'Casual pace', minutes: '~5 min/day' },
  { id: 20, label: '20 words', desc: 'Steady progress', minutes: '~10 min/day' },
  { id: 30, label: '30 words', desc: 'Committed learner', minutes: '~15 min/day' },
  { id: 50, label: '50 words', desc: 'Intensive mode', minutes: '~25 min/day' },
]

const PURPOSES = [
  { id: 'daily', label: 'Daily Life', desc: 'Everyday conversations', icon: Globe },
  { id: 'academic', label: 'Academic', desc: 'Study & research', icon: GraduationCap },
  { id: 'business', label: 'Business', desc: 'Professional use', icon: Briefcase },
  { id: 'exam', label: 'Exam Prep', desc: 'TOEFL, IELTS, etc.', icon: PenTool },
]

const ACCENTS = [
  { id: 'us', label: 'American English', flag: '🇺🇸', desc: 'US pronunciation' },
  { id: 'uk', label: 'British English', flag: '🇬🇧', desc: 'UK pronunciation' },
]

interface OnboardingData {
  level: string
  dailyGoal: number
  purpose: string
  accent: string
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    level: '',
    dailyGoal: 0,
    purpose: '',
    accent: '',
  })

  const canProceed = () => {
    switch (step) {
      case 0: return !!data.level
      case 1: return !!data.dailyGoal
      case 2: return !!data.purpose
      case 3: return !!data.accent
      default: return false
    }
  }

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }
    await handleFinish()
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      await api.post('/user/onboarding', {
        level: data.level,
        dailyGoal: data.dailyGoal,
        learningGoal: data.purpose,
        accent: data.accent,
      })
      showToast('Setup complete! Let\'s start learning.', 'success')
      navigate('/')
    } catch (err: any) {
      showToast(err.message || 'Setup failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      await api.post('/user/onboarding', {
        level: data.level || 'intermediate',
        dailyGoal: data.dailyGoal || 20,
        learningGoal: data.purpose || 'daily',
        accent: data.accent || 'us',
      })
      navigate('/')
    } catch {
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const slideVariants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === step ? "w-8 bg-indigo-600" : i < step ? "w-8 bg-indigo-300 dark:bg-indigo-700" : "w-8 bg-gray-200 dark:bg-gray-700"
                )}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Skip <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-700 p-8 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1"
            >
              {step === 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">What's your English level?</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">We'll personalize your experience</p>
                  <div className="grid grid-cols-2 gap-3">
                    {LEVELS.map((level) => {
                      const Icon = level.icon
                      return (
                        <motion.button
                          key={level.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setData({ ...data, level: level.id })}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            data.level === level.id
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400"
                              : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                          )}
                        >
                          <Icon className={cn(
                            "w-5 h-5 mb-2",
                            data.level === level.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"
                          )} />
                          <div className="font-medium text-sm text-gray-900 dark:text-white">{level.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{level.desc}</div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Set your daily goal</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">How many words per day?</p>
                  <div className="space-y-3">
                    {GOALS.map((goal) => (
                      <motion.button
                        key={goal.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setData({ ...data, dailyGoal: goal.id })}
                        className={cn(
                          "w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all",
                          data.dailyGoal === goal.id
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400"
                            : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Target className={cn(
                            "w-5 h-5",
                            data.dailyGoal === goal.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"
                          )} />
                          <div className="text-left">
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{goal.label}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{goal.desc}</div>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{goal.minutes}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">What's your goal?</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">We'll tailor vocabulary to your needs</p>
                  <div className="grid grid-cols-2 gap-3">
                    {PURPOSES.map((purpose) => {
                      const Icon = purpose.icon
                      return (
                        <motion.button
                          key={purpose.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setData({ ...data, purpose: purpose.id })}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            data.purpose === purpose.id
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400"
                              : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                          )}
                        >
                          <Icon className={cn(
                            "w-5 h-5 mb-2",
                            data.purpose === purpose.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"
                          )} />
                          <div className="font-medium text-sm text-gray-900 dark:text-white">{purpose.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{purpose.desc}</div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Preferred accent</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose your pronunciation style</p>
                  <div className="space-y-3">
                    {ACCENTS.map((accent) => (
                      <motion.button
                        key={accent.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setData({ ...data, accent: accent.id })}
                        className={cn(
                          "w-full p-5 rounded-xl border-2 flex items-center gap-4 transition-all",
                          data.accent === accent.id
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400"
                            : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                        )}
                      >
                        <span className="text-3xl">{accent.flag}</span>
                        <div className="text-left">
                          <div className="font-medium text-gray-900 dark:text-white">{accent.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{accent.desc}</div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-0 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : step === STEPS.length - 1 ? (
                'Get Started'
              ) : (
                <>Next <ChevronRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
