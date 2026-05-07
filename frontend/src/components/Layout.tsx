import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'
import {
  LayoutDashboard, BookOpen, Languages, MessageSquare, Shuffle,
  XCircle, Eye, BarChart3, Settings, LogOut, Menu, X, Library
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '首頁' },
  { path: '/words', icon: Library, label: '題庫總覽' },
  { path: '/practice/word', icon: BookOpen, label: '單字練習' },
  { path: '/practice/grammar', icon: Languages, label: '文法練習' },
  { path: '/practice/phrase', icon: MessageSquare, label: '片語練習' },
  { path: '/practice/mixed', icon: Shuffle, label: '綜合練習' },
  { path: '/review/wrong', icon: XCircle, label: '錯題本' },
  { path: '/review/seen', icon: Eye, label: '已看題目' },
  { path: '/stats', icon: BarChart3, label: '學習統計' },
  { path: '/settings', icon: Settings, label: '設定' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch {}
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card/80 backdrop-blur-lg border-r border-border shadow-xl transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <motion.img
            src="/logo-48.png"
            alt="English Learner"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-9 h-9 rounded-lg shadow-lg shadow-primary/25"
          />
          <span className="font-semibold text-lg text-foreground">English Learner</span>
          <button className="ml-auto lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary border-l-[3px] border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
          >
            <LogOut size={18} />
            登出
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <header className="sticky top-0 z-30 flex items-center gap-4 px-6 py-4 bg-background/80 backdrop-blur-sm border-b border-border lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-foreground">English Learner</span>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6 lg:p-8 max-w-7xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
