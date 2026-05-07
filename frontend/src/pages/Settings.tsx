import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTTS } from '../hooks/useTTS'
import { useThemeStore } from '../stores/theme'
import { showToast } from '../components/ui/Toaster'
import { cn } from '../lib/utils'
import {
  User, Camera, Sun, Moon, Monitor, Volume2, Download,
  Trash2, Keyboard, X,
} from 'lucide-react'

const DEBOUNCE_MS = 500
const DAILY_GOAL_MIN = 5
const DAILY_GOAL_MAX = 100
const DAILY_GOAL_STEP = 5
const TTS_PREVIEW_TEXT = 'Hello, welcome to English Learner'
const STAGGER_DELAY = 0.08

type Accent = 'us' | 'uk'
type DefinitionLang = 'zh-TW' | 'en' | 'both'

interface UserSettings {
  dailyGoal: number
  definitionLang: DefinitionLang
  showPhonetic: boolean
  showEtymology: boolean
  accent: Accent
  autoPlayAudio: boolean
  keyboardShortcuts: boolean
  enabledQuestionTypes: string
}

interface UserProfile {
  displayName: string
  email: string
  avatarUrl?: string
}

interface UserResponse {
  user: UserProfile
  settings: UserSettings
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: STAGGER_DELAY },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 20 } },
}

export default function Settings() {
  const queryClient = useQueryClient()
  const { theme, setTheme } = useThemeStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [localSettings, setLocalSettings] = useState<UserSettings | null>(null)
  const [displayName, setDisplayName] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery<UserResponse>({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me'),
  })

  const accentForTTS = localSettings?.accent ?? 'us'
  const { speak, isSpeaking } = useTTS({ accent: accentForTTS })

  useEffect(() => {
    if (data) {
      setLocalSettings(data.settings)
      setDisplayName(data.user.displayName)
    }
  }, [data])

  const settingsMutation = useMutation({
    mutationFn: (settings: Partial<UserSettings>) => api.patch('/user/settings', settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-me'] }),
    onError: () => showToast('Failed to save settings', 'error'),
  })

  const profileMutation = useMutation({
    mutationFn: (body: { displayName: string }) => api.patch('/user/profile', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-me'] })
      showToast('Profile updated', 'success')
    },
    onError: () => showToast('Failed to update profile', 'error'),
  })

  const avatarMutation = useMutation({
    mutationFn: (formData: FormData) => api.upload('/user/avatar', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-me'] })
      showToast('Avatar updated', 'success')
    },
    onError: () => showToast('Failed to upload avatar', 'error'),
  })

  const debouncedSave = useCallback((settings: Partial<UserSettings>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => settingsMutation.mutate(settings), DEBOUNCE_MS)
  }, [settingsMutation])

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    if (!localSettings) return
    const updated = { ...localSettings, [key]: value }
    setLocalSettings(updated)
    debouncedSave({ [key]: value })
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    avatarMutation.mutate(formData)
  }

  const handleNameBlur = () => {
    if (displayName && displayName !== data?.user.displayName) {
      profileMutation.mutate({ displayName })
    }
  }

  const handleExport = async () => {
    try {
      const blob = await api.get<Blob>('/user/export')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'english-learner-data.json'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Data exported successfully', 'success')
    } catch {
      showToast('Failed to export data', 'error')
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await api.post('/user/delete')
      showToast('Account deleted', 'info')
      window.location.href = '/login'
    } catch {
      showToast('Failed to delete account', 'error')
    }
  }

  if (!data || !localSettings) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-2xl"
    >
      <motion.h1 variants={itemVariants} className="text-2xl font-bold text-foreground">
        Settings
      </motion.h1>

      <Section title="Profile" variants={itemVariants}>
        <div className="flex items-center gap-5">
          <button onClick={handleAvatarClick} className="relative group">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden ring-2 ring-indigo-500/20 ring-offset-2 ring-offset-card group-hover:ring-indigo-500/50 transition-all">
              {data.user.avatarUrl ? (
                <img src={data.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </button>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={handleNameBlur}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <input
                type="email"
                value={data.user.email}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-sm cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Learning Preferences" variants={itemVariants}>
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Daily Goal</label>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{localSettings.dailyGoal} items</span>
            </div>
            <input
              type="range"
              min={DAILY_GOAL_MIN}
              max={DAILY_GOAL_MAX}
              step={DAILY_GOAL_STEP}
              value={localSettings.dailyGoal}
              onChange={(e) => updateSetting('dailyGoal', Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{DAILY_GOAL_MIN}</span>
              <span>{DAILY_GOAL_MAX}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Definition Language</label>
            <div className="flex gap-2">
              {([['zh-TW', '中文'], ['en', 'English'], ['both', 'Both']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => updateSetting('definitionLang', val)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    localSettings.definitionLang === val
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500 shadow-sm shadow-indigo-500/10"
                      : "border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Toggle label="Show Phonetic" checked={localSettings.showPhonetic} onChange={(v) => updateSetting('showPhonetic', v)} />
          <Toggle label="Show Etymology / Word Analysis" checked={localSettings.showEtymology} onChange={(v) => updateSetting('showEtymology', v)} />
        </div>
      </Section>

      <Section title="Practice Question Types" variants={itemVariants}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Select the question types you want to practice. At least one must be enabled.</p>
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'zh-to-en', label: '中文 → English' },
              { value: 'en-to-zh', label: 'English → 中文' },
              { value: 'fill-blank', label: 'Fill in the Blank' },
              { value: 'listen', label: 'Listening' },
            ] as const).map(({ value, label }) => {
              const types = (localSettings.enabledQuestionTypes || 'zh-to-en,en-to-zh,fill-blank,listen').split(',')
              const isEnabled = types.includes(value)
              return (
                <button
                  key={value}
                  onClick={() => {
                    const current = types.filter(Boolean)
                    let next: string[]
                    if (isEnabled) {
                      if (current.length <= 1) return
                      next = current.filter((t) => t !== value)
                    } else {
                      next = [...current, value]
                    }
                    updateSetting('enabledQuestionTypes', next.join(','))
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    isEnabled
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500 shadow-sm shadow-indigo-500/10"
                      : "border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      <Section title="Audio" variants={itemVariants}>
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Accent Preference</label>
            <div className="flex items-center gap-3">
              {(['us', 'uk'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => updateSetting('accent', a)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    localSettings.accent === a
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500 shadow-sm shadow-indigo-500/10"
                      : "border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground"
                  )}
                >
                  {a === 'us' ? '🇺🇸 US' : '🇬🇧 UK'}
                </button>
              ))}
              <button
                onClick={() => speak(TTS_PREVIEW_TEXT)}
                disabled={isSpeaking}
                className="ml-2 p-2 rounded-lg hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 transition-colors"
                title="Preview"
              >
                <Volume2 size={18} />
              </button>
            </div>
          </div>
          <Toggle label="Auto-play on Answer" checked={localSettings.autoPlayAudio} onChange={(v) => updateSetting('autoPlayAudio', v)} />
        </div>
      </Section>

      <Section title="Interface" variants={itemVariants}>
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Theme</label>
            <div className="flex gap-2">
              {([
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'System' },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    theme === value
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500 shadow-sm shadow-indigo-500/10"
                      : "border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Keyboard Shortcuts"
            icon={<Keyboard size={16} />}
            checked={localSettings.keyboardShortcuts}
            onChange={(v) => updateSetting('keyboardShortcuts', v)}
          />
        </div>
      </Section>

      <Section title="Advanced" variants={itemVariants}>
        <div className="space-y-4">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Download size={16} />
            Export Data
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-700 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          >
            <Trash2 size={16} />
            Delete Account
          </button>
        </div>
      </Section>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Delete Account</h3>
              <button onClick={() => setShowDeleteDialog(false)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This action is permanent and cannot be undone. All your data will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

function Section({ title, children, variants }: { title: string; children: React.ReactNode; variants?: any }) {
  return (
    <motion.section
      variants={variants}
      className="bg-card border border-border rounded-xl p-6 shadow-sm"
    >
      <h2 className="text-base font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </motion.section>
  )
}

function Toggle({ label, checked, onChange, icon }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "w-11 h-6 rounded-full transition-all relative shadow-inner",
          checked ? "bg-indigo-500 shadow-indigo-600/20" : "bg-muted-foreground/30"
        )}
      >
        <motion.div
          animate={{ x: checked ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  )
}
