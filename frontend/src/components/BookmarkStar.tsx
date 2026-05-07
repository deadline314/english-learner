import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { cn } from '../lib/utils'

interface BookmarkStarProps {
  itemType: 'word' | 'grammar' | 'phrase'
  itemId: number
  bookmarkType: 'seen' | 'wrong'
  initialBookmarked?: boolean
  label?: string
  className?: string
}

export function BookmarkStar({
  itemType,
  itemId,
  bookmarkType,
  initialBookmarked = false,
  label,
  className,
}: BookmarkStarProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [showPop, setShowPop] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.post<{ bookmarked: boolean }>('/practice/bookmark', { itemType, itemId, bookmarkType }),
    onSuccess: (data) => {
      setBookmarked(data.bookmarked)
      if (data.bookmarked) {
        setShowPop(true)
        setTimeout(() => setShowPop(false), 1500)
      }
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    },
  })

  const color = bookmarkType === 'seen'
    ? bookmarked ? 'text-amber-400' : 'text-muted-foreground'
    : bookmarked ? 'text-rose-400' : 'text-muted-foreground'

  const hoverColor = bookmarkType === 'seen' ? 'hover:text-amber-400' : 'hover:text-rose-400'

  const popText = bookmarkType === 'seen'
    ? bookmarked ? '已加入看過收藏 ⭐' : '已移除'
    : bookmarked ? '已加入錯題收藏 ⭐' : '已移除'

  return (
    <div className={cn('relative inline-flex items-center gap-1.5', className)}>
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          color, hoverColor,
          mutation.isPending && 'opacity-50 cursor-wait',
        )}
        title={bookmarkType === 'seen' ? '收藏到看過清單' : '收藏到錯題清單'}
      >
        <Star
          className={cn('w-5 h-5 transition-all', bookmarked && 'fill-current')}
        />
      </motion.button>
      {label && (
        <span className={cn('text-xs', color)}>{label}</span>
      )}
      <AnimatePresence>
        {showPop && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-foreground text-background rounded-md px-2 py-1 pointer-events-none z-50"
          >
            {popText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
