import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'
import { showToast } from '../components/ui/Toaster'
import { ShieldCheck } from 'lucide-react'
import { cn } from '../lib/utils'

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60

interface VerifyResponse {
  token: string
  message: string
}

export default function Verify() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const userId = searchParams.get('userId') || ''

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const submitCode = useCallback(async (fullCode: string) => {
    setLoading(true)
    try {
      const res = await api.post<VerifyResponse>('/auth/verify', { userId, code: fullCode })
      useAuthStore.getState().setAuth(res.token, userId)
      showToast('Email verified!', 'success')
      navigate('/onboarding')
    } catch (err: any) {
      showToast(err.message || 'Verification failed', 'error')
      setCode(Array(CODE_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }, [userId, navigate])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    const fullCode = newCode.join('')
    if (fullCode.length === CODE_LENGTH) {
      submitCode(fullCode)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return

    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)

    const nextIndex = Math.min(pasted.length, CODE_LENGTH - 1)
    inputRefs.current[nextIndex]?.focus()

    if (pasted.length === CODE_LENGTH) {
      submitCode(pasted)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    try {
      await api.post('/auth/resend-code', { userId })
      showToast('Verification code resent', 'success')
      setCooldown(RESEND_COOLDOWN)
    } catch (err: any) {
      showToast(err.message || 'Failed to resend code', 'error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
          >
            <ShieldCheck className="w-7 h-7 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Your Email</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-700 p-8">
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <motion.input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className={cn(
                  "w-12 h-14 text-center text-xl font-semibold rounded-lg border bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                  digit ? "border-indigo-300 dark:border-indigo-600" : "border-gray-200 dark:border-gray-600"
                )}
              />
            ))}
          </div>

          {loading && (
            <div className="flex justify-center mt-6">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              onClick={handleResend}
              disabled={cooldown > 0}
              className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
