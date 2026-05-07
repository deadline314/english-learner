import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

export const progressRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>()

progressRoutes.use('*', authMiddleware)

progressRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId')
  const now = Math.floor(Date.now() / 1000)
  const today = new Date().toISOString().split('T')[0]

  const [streak, todayActivity, wordsDue, grammarDue, phrasesDue, wordsNew, grammarNew, phrasesNew, recentWrong, weeklyActivity] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM user_streaks WHERE user_id = ?').bind(userId).first(),
    c.env.DB.prepare('SELECT questions_answered, correct_count FROM daily_activity WHERE user_id = ? AND date = ?').bind(userId, today).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM user_word_progress WHERE user_id = ? AND next_review_at <= ?').bind(userId, now).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM user_grammar_progress WHERE user_id = ? AND next_review_at <= ?').bind(userId, now).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM user_phrase_progress WHERE user_id = ? AND next_review_at <= ?').bind(userId, now).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM words WHERE word_id NOT IN (SELECT word_id FROM user_word_progress WHERE user_id = ?)').bind(userId).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM grammar_questions WHERE id NOT IN (SELECT question_id FROM user_grammar_progress WHERE user_id = ?)').bind(userId).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM phrases WHERE id NOT IN (SELECT phrase_id FROM user_phrase_progress WHERE user_id = ?)').bind(userId).first(),
    c.env.DB.prepare(
      `SELECT wa.*, w.word, w.definitions_json FROM wrong_answers wa
       LEFT JOIN words w ON wa.item_type = 'word' AND wa.item_id = w.word_id
       WHERE wa.user_id = ? AND wa.mastered = 0
       ORDER BY wa.created_at DESC LIMIT 5`
    ).bind(userId).all(),
    c.env.DB.prepare(
      `SELECT date, questions_answered as count FROM daily_activity
       WHERE user_id = ? AND date >= date('now', '-7 days')
       ORDER BY date ASC`
    ).bind(userId).all(),
  ])

  const settings = await c.env.DB.prepare('SELECT daily_goal FROM user_settings WHERE user_id = ?').bind(userId).first<{ daily_goal: number }>()
  const dailyGoal = settings?.daily_goal || 20

  return c.json({
    todayProgress: {
      completed: (todayActivity as any)?.questions_answered || 0,
      total: dailyGoal,
    },
    streak: {
      currentStreak: (streak as any)?.current_streak || 0,
      longestStreak: (streak as any)?.longest_streak || 0,
      lastActiveDate: (streak as any)?.last_active_date || '',
      totalDays: (streak as any)?.total_days || 0,
    },
    wordsDue: (wordsDue as any)?.count || 0,
    grammarDue: (grammarDue as any)?.count || 0,
    phrasesDue: (phrasesDue as any)?.count || 0,
    wordsNew: (wordsNew as any)?.count || 0,
    grammarNew: (grammarNew as any)?.count || 0,
    phrasesNew: (phrasesNew as any)?.count || 0,
    recentWrong: (recentWrong.results || []).map((w: any) => ({
      id: w.id,
      itemType: w.item_type,
      itemId: w.item_id,
      userAnswer: w.user_answer,
      correctAnswer: w.correct_answer,
      createdAt: w.created_at,
      mastered: !!w.mastered,
      word: w.word,
    })),
    weeklyActivity: (weeklyActivity.results || []).map((a: any) => ({
      date: a.date,
      count: a.count,
    })),
  })
})

progressRoutes.get('/wrong', async (c) => {
  const userId = c.get('userId')
  const type = c.req.query('type') || 'word'
  const page = parseInt(c.req.query('page') || '1')
  const filter = c.req.query('filter') || 'all'
  const pageSize = 20
  const offset = (page - 1) * pageSize

  let whereClause = 'wa.user_id = ? AND wa.item_type = ?'
  if (filter === 'unmastered') whereClause += ' AND wa.mastered = 0'
  else if (filter === 'mastered') whereClause += ' AND wa.mastered = 1'

  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM wrong_answers wa WHERE ${whereClause}`
  ).bind(userId, type).first<{ count: number }>()

  let query: string
  if (type === 'word') {
    query = `SELECT wa.*, w.word, w.phonetic, w.definitions_json, w.examples_json
             FROM wrong_answers wa LEFT JOIN words w ON wa.item_id = w.word_id
             WHERE ${whereClause} ORDER BY wa.created_at DESC LIMIT ? OFFSET ?`
  } else if (type === 'grammar') {
    query = `SELECT wa.*, gq.question, gq.explanation, gq.correct_answer as grammar_correct
             FROM wrong_answers wa LEFT JOIN grammar_questions gq ON wa.item_id = gq.id
             WHERE ${whereClause} ORDER BY wa.created_at DESC LIMIT ? OFFSET ?`
  } else {
    query = `SELECT wa.*, p.phrase, p.meaning_zh, p.meaning_en
             FROM wrong_answers wa LEFT JOIN phrases p ON wa.item_id = p.id
             WHERE ${whereClause} ORDER BY wa.created_at DESC LIMIT ? OFFSET ?`
  }

  const results = await c.env.DB.prepare(query).bind(userId, type, pageSize, offset).all()

  return c.json({
    items: (results.results || []).map((r: any) => ({
      id: r.id,
      itemType: r.item_type,
      itemId: r.item_id,
      userAnswer: r.user_answer,
      correctAnswer: r.correct_answer,
      createdAt: r.created_at,
      mastered: !!r.mastered,
      word: r.word,
      phonetic: r.phonetic,
      definitions: r.definitions_json ? JSON.parse(r.definitions_json) : null,
      question: r.question,
      explanation: r.explanation,
      phrase: r.phrase,
      meaningZh: r.meaning_zh,
    })),
    total: total?.count || 0,
    page,
    pageSize,
  })
})

progressRoutes.post('/wrong/:id/master', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE wrong_answers SET mastered = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ success: true })
})

progressRoutes.get('/seen', async (c) => {
  const userId = c.get('userId')
  const type = c.req.query('type') || 'word'
  const page = parseInt(c.req.query('page') || '1')
  const srsLevel = c.req.query('srs_level')
  const pageSize = 20
  const offset = (page - 1) * pageSize

  if (type === 'word') {
    let whereClause = 'p.user_id = ?'
    const params: any[] = [userId]
    if (srsLevel !== undefined && srsLevel !== '') {
      whereClause += ' AND p.srs_level = ?'
      params.push(parseInt(srsLevel))
    }

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM user_word_progress p WHERE ${whereClause}`
    ).bind(...params).first<{ count: number }>()

    const results = await c.env.DB.prepare(
      `SELECT p.*, w.word, w.phonetic, w.definitions_json, w.part_of_speech
       FROM user_word_progress p JOIN words w ON p.word_id = w.word_id
       WHERE ${whereClause} ORDER BY p.last_seen_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all()

    return c.json({
      items: (results.results || []).map((r: any) => ({
        wordId: r.word_id,
        word: r.word,
        phonetic: r.phonetic,
        partOfSpeech: r.part_of_speech,
        definitions: JSON.parse(r.definitions_json || '{}'),
        srsLevel: r.srs_level,
        totalSeen: r.total_seen,
        totalCorrect: r.total_correct,
        totalWrong: r.total_wrong,
        lastSeenAt: r.last_seen_at,
        nextReviewAt: r.next_review_at,
      })),
      total: total?.count || 0,
      page,
      pageSize,
    })
  }

  return c.json({ items: [], total: 0, page, pageSize })
})

progressRoutes.get('/stats', async (c) => {
  const userId = c.get('userId')
  const period = c.req.query('period') || '30d'
  const days = parseInt(period) || 30

  const [streak, dailyActivity, wordProgress, totalSessions] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM user_streaks WHERE user_id = ?').bind(userId).first(),
    c.env.DB.prepare(
      `SELECT date, questions_answered, correct_count FROM daily_activity
       WHERE user_id = ? AND date >= date('now', '-' || ? || ' days') ORDER BY date ASC`
    ).bind(userId, days).all(),
    c.env.DB.prepare(
      `SELECT srs_level, COUNT(*) as count FROM user_word_progress WHERE user_id = ? GROUP BY srs_level`
    ).bind(userId).all(),
    c.env.DB.prepare(
      `SELECT mode, COUNT(*) as count, SUM(total_questions) as total_q, SUM(correct_count) as total_c
       FROM practice_sessions WHERE user_id = ? GROUP BY mode`
    ).bind(userId).all(),
  ])

  const hardestWords = await c.env.DB.prepare(
    `SELECT w.word, p.total_wrong FROM user_word_progress p
     JOIN words w ON p.word_id = w.word_id
     WHERE p.user_id = ? AND p.total_wrong > 0
     ORDER BY p.total_wrong DESC LIMIT 10`
  ).bind(userId).all()

  let totalAnswered = 0
  let totalCorrect = 0
  for (const session of (totalSessions.results || []) as any[]) {
    totalAnswered += session.total_q || 0
    totalCorrect += session.total_c || 0
  }

  return c.json({
    totalDays: (streak as any)?.total_days || 0,
    totalAnswered,
    correctRate: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
    currentStreak: (streak as any)?.current_streak || 0,
    dailyActivity: (dailyActivity.results || []).map((a: any) => ({
      date: a.date,
      count: a.questions_answered,
      correct: a.correct_count,
    })),
    typeDistribution: (totalSessions.results || []).map((s: any) => ({
      type: s.mode,
      count: s.count,
    })),
    srsDistribution: (wordProgress.results || []).map((s: any) => ({
      level: s.srs_level,
      count: s.count,
    })),
    hardestWords: (hardestWords.results || []).map((w: any) => ({
      word: w.word,
      wrongCount: w.total_wrong,
    })),
  })
})
