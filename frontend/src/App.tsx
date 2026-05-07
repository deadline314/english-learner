import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Verify from './pages/Verify'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import PracticeWord from './pages/PracticeWord'
import PracticeGrammar from './pages/PracticeGrammar'
import PracticePhrase from './pages/PracticePhrase'
import PracticeMixed from './pages/PracticeMixed'
import ReviewWrong from './pages/ReviewWrong'
import ReviewSeen from './pages/ReviewSeen'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import WordList from './pages/WordList'
import Bookmarks from './pages/Bookmarks'
import PracticeToeic from './pages/PracticeToeic'
import { Toaster } from './components/ui/Toaster'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const location = useLocation()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
    }
  }, [theme])

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />
            <Route path="practice/word" element={<PracticeWord />} />
            <Route path="practice/grammar" element={<PracticeGrammar />} />
            <Route path="practice/phrase" element={<PracticePhrase />} />
            <Route path="practice/mixed" element={<PracticeMixed />} />
            <Route path="practice/toeic" element={<PracticeToeic />} />
            <Route path="review/wrong" element={<ReviewWrong />} />
            <Route path="review/seen" element={<ReviewSeen />} />
            <Route path="bookmarks" element={<Bookmarks />} />
            <Route path="stats" element={<Stats />} />
            <Route path="words" element={<WordList />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      <Toaster />
    </>
  )
}
