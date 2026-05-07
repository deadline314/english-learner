import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'
import { calculateSrs } from '../services/srs'

export const practiceRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>()

practiceRoutes.use('*', authMiddleware)

const DAILY_LIMIT = 20

practiceRoutes.get('/today', async (c) => {
  const userId = c.get('userId')
  const mode = c.req.query('mode') || 'word'
  const now = Math.floor(Date.now() / 1000)

  if (mode === 'word') {
    const dueWords = await c.env.DB.prepare(
      `SELECT w.* FROM words w
       JOIN user_word_progress p ON w.word_id = p.word_id
       WHERE p.user_id = ? AND p.next_review_at <= ?
       ORDER BY p.next_review_at ASC LIMIT ?`
    ).bind(userId, now, DAILY_LIMIT).all()

    let items = dueWords.results || []

    if (items.length < DAILY_LIMIT) {
      const remaining = DAILY_LIMIT - items.length
      const newWords = await c.env.DB.prepare(
        `SELECT * FROM words WHERE word_id NOT IN
         (SELECT word_id FROM user_word_progress WHERE user_id = ?)
         ORDER BY RANDOM() LIMIT ?`
      ).bind(userId, remaining).all()
      items = [...items, ...(newWords.results || [])]
    }

    const formatted = items.map((w: any) => ({
      wordId: w.word_id,
      word: w.word,
      phonetic: w.phonetic,
      partOfSpeech: w.part_of_speech,
      definitions: JSON.parse(w.definitions_json || '{}'),
      analysis: w.analysis_json ? JSON.parse(w.analysis_json) : null,
      collocation: w.collocation,
      examples: JSON.parse(w.examples_json || '[]'),
      wordFamily: JSON.parse(w.word_family_json || '{}'),
      secondaryMeaningNote: w.secondary_meaning_note || null,
      difficulty: w.difficulty,
      frequencyRank: w.frequency_rank,
    }))

    return c.json({ items: formatted, sessionId: crypto.randomUUID(), mode: 'word' })
  }

  if (mode === 'grammar') {
    const dueGrammar = await c.env.DB.prepare(
      `SELECT gq.*, gt.title as topic_title FROM grammar_questions gq
       JOIN grammar_topics gt ON gq.topic_id = gt.id
       LEFT JOIN user_grammar_progress p ON gq.id = p.question_id AND p.user_id = ?
       WHERE p.question_id IS NULL OR p.next_review_at <= ?
       ORDER BY CASE WHEN p.question_id IS NULL THEN 0 ELSE 1 END, RANDOM()
       LIMIT ?`
    ).bind(userId, now, DAILY_LIMIT).all()

    const formatted = (dueGrammar.results || []).map((q: any) => ({
      id: q.id,
      topicId: q.topic_id,
      topicTitle: q.topic_title,
      questionType: q.question_type,
      question: q.question,
      options: JSON.parse(q.options_json || '[]'),
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
    }))

    return c.json({ items: formatted, sessionId: crypto.randomUUID(), mode: 'grammar' })
  }

  if (mode === 'phrase') {
    const duePhrases = await c.env.DB.prepare(
      `SELECT ph.* FROM phrases ph
       LEFT JOIN user_phrase_progress p ON ph.id = p.phrase_id AND p.user_id = ?
       WHERE p.phrase_id IS NULL OR p.next_review_at <= ?
       ORDER BY CASE WHEN p.phrase_id IS NULL THEN 0 ELSE 1 END, RANDOM()
       LIMIT ?`
    ).bind(userId, now, DAILY_LIMIT).all()

    const formatted = (duePhrases.results || []).map((p: any) => ({
      id: p.id,
      phrase: p.phrase,
      meaningZh: p.meaning_zh,
      meaningEn: p.meaning_en,
      examples: JSON.parse(p.examples_json || '[]'),
      category: p.category,
    }))

    return c.json({ items: formatted, sessionId: crypto.randomUUID(), mode: 'phrase' })
  }

  if (mode === 'mixed') {
    const wordCount = 8
    const grammarCount = 6
    const phraseCount = 6

    const [words, grammar, phrases] = await Promise.all([
      c.env.DB.prepare(
        `SELECT w.* FROM words w
         LEFT JOIN user_word_progress p ON w.word_id = p.word_id AND p.user_id = ?
         WHERE p.word_id IS NULL OR p.next_review_at <= ?
         ORDER BY CASE WHEN p.word_id IS NULL THEN 0 ELSE 1 END, RANDOM()
         LIMIT ?`
      ).bind(userId, now, wordCount).all(),
      c.env.DB.prepare(
        `SELECT gq.*, gt.title as topic_title FROM grammar_questions gq
         JOIN grammar_topics gt ON gq.topic_id = gt.id
         LEFT JOIN user_grammar_progress p ON gq.id = p.question_id AND p.user_id = ?
         WHERE p.question_id IS NULL OR p.next_review_at <= ?
         ORDER BY RANDOM() LIMIT ?`
      ).bind(userId, now, grammarCount).all(),
      c.env.DB.prepare(
        `SELECT ph.* FROM phrases ph
         LEFT JOIN user_phrase_progress p ON ph.id = p.phrase_id AND p.user_id = ?
         WHERE p.phrase_id IS NULL OR p.next_review_at <= ?
         ORDER BY RANDOM() LIMIT ?`
      ).bind(userId, now, phraseCount).all(),
    ])

    const items = [
      ...(words.results || []).map((w: any) => ({
        itemType: 'word' as const,
        item: {
          wordId: w.word_id, word: w.word, phonetic: w.phonetic, partOfSpeech: w.part_of_speech,
          definitions: JSON.parse(w.definitions_json || '{}'), analysis: w.analysis_json ? JSON.parse(w.analysis_json) : null,
          collocation: w.collocation, examples: JSON.parse(w.examples_json || '[]'),
          wordFamily: JSON.parse(w.word_family_json || '{}'),
          secondaryMeaningNote: w.secondary_meaning_note || null,
          difficulty: w.difficulty, frequencyRank: w.frequency_rank,
        },
      })),
      ...(grammar.results || []).map((q: any) => ({
        itemType: 'grammar' as const,
        item: {
          id: q.id, topicId: q.topic_id, topicTitle: q.topic_title, questionType: q.question_type,
          question: q.question, options: JSON.parse(q.options_json || '[]'),
          correctAnswer: q.correct_answer, explanation: q.explanation,
        },
      })),
      ...(phrases.results || []).map((p: any) => ({
        itemType: 'phrase' as const,
        item: {
          id: p.id, phrase: p.phrase, meaningZh: p.meaning_zh, meaningEn: p.meaning_en,
          examples: JSON.parse(p.examples_json || '[]'), category: p.category,
        },
      })),
    ]

    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]]
    }

    return c.json({ items, sessionId: crypto.randomUUID(), mode: 'mixed' })
  }

  return c.json({ error: '無效的模式' }, 400)
})

practiceRoutes.post('/submit', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    sessionId: string
    mode: string
    answers: { itemId: number; itemType: string; correct: boolean; timeMs: number; userAnswer?: string }[]
  }>()

  const { sessionId, mode, answers } = body
  const now = Math.floor(Date.now() / 1000)
  const today = new Date().toISOString().split('T')[0]

  let correctCount = 0
  const totalQuestions = answers.length

  const wordAnswers = answers.filter(a => a.itemType === 'word')
  const grammarAnswers = answers.filter(a => a.itemType === 'grammar')
  const phraseAnswers = answers.filter(a => a.itemType === 'phrase')

  for (const answer of answers) {
    if (answer.correct) correctCount++
  }

  const existingProgressQueries = [
    ...wordAnswers.map(a =>
      c.env.DB.prepare('SELECT word_id as item_id, srs_level, ease_factor, interval_days FROM user_word_progress WHERE user_id = ? AND word_id = ?')
        .bind(userId, a.itemId)
    ),
    ...grammarAnswers.map(a =>
      c.env.DB.prepare('SELECT question_id as item_id, srs_level, ease_factor, interval_days FROM user_grammar_progress WHERE user_id = ? AND question_id = ?')
        .bind(userId, a.itemId)
    ),
    ...phraseAnswers.map(a =>
      c.env.DB.prepare('SELECT phrase_id as item_id, srs_level, ease_factor, interval_days FROM user_phrase_progress WHERE user_id = ? AND phrase_id = ?')
        .bind(userId, a.itemId)
    ),
  ]

  const existingResults = existingProgressQueries.length > 0
    ? await c.env.DB.batch(existingProgressQueries)
    : []

  let resultIdx = 0
  const wordExisting = new Map<number, { srs_level: number; ease_factor: number; interval_days: number }>()
  for (const a of wordAnswers) {
    const row = existingResults[resultIdx]?.results?.[0] as any
    if (row) wordExisting.set(a.itemId, row)
    resultIdx++
  }
  const grammarExisting = new Map<number, { srs_level: number; ease_factor: number; interval_days: number }>()
  for (const a of grammarAnswers) {
    const row = existingResults[resultIdx]?.results?.[0] as any
    if (row) grammarExisting.set(a.itemId, row)
    resultIdx++
  }
  const phraseExisting = new Map<number, { srs_level: number; ease_factor: number; interval_days: number }>()
  for (const a of phraseAnswers) {
    const row = existingResults[resultIdx]?.results?.[0] as any
    if (row) phraseExisting.set(a.itemId, row)
    resultIdx++
  }

  const updateStatements: any[] = []

  for (const answer of wordAnswers) {
    const existing = wordExisting.get(answer.itemId)
    const current = existing || { srs_level: 0, ease_factor: 2.5, interval_days: 0 }
    const updated = calculateSrs(answer.correct, current.srs_level, current.ease_factor, current.interval_days)

    if (existing) {
      updateStatements.push(
        c.env.DB.prepare(
          `UPDATE user_word_progress SET srs_level = ?, ease_factor = ?, interval_days = ?, next_review_at = ?,
           total_seen = total_seen + 1, total_correct = total_correct + ?, total_wrong = total_wrong + ?,
           last_seen_at = ?, last_result = ? WHERE user_id = ? AND word_id = ?`
        ).bind(updated.srsLevel, updated.easeFactor, updated.intervalDays, updated.nextReviewAt,
          answer.correct ? 1 : 0, answer.correct ? 0 : 1, now, answer.correct ? 1 : 0, userId, answer.itemId)
      )
    } else {
      updateStatements.push(
        c.env.DB.prepare(
          `INSERT INTO user_word_progress (user_id, word_id, srs_level, ease_factor, interval_days, next_review_at, total_seen, total_correct, total_wrong, last_seen_at, last_result)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
        ).bind(userId, answer.itemId, updated.srsLevel, updated.easeFactor, updated.intervalDays, updated.nextReviewAt,
          answer.correct ? 1 : 0, answer.correct ? 0 : 1, now, answer.correct ? 1 : 0)
      )
    }
  }

  for (const answer of grammarAnswers) {
    const existing = grammarExisting.get(answer.itemId)
    const current = existing || { srs_level: 0, ease_factor: 2.5, interval_days: 0 }
    const updated = calculateSrs(answer.correct, current.srs_level, current.ease_factor, current.interval_days)

    if (existing) {
      updateStatements.push(
        c.env.DB.prepare(
          `UPDATE user_grammar_progress SET srs_level = ?, ease_factor = ?, interval_days = ?, next_review_at = ?,
           total_seen = total_seen + 1, total_correct = total_correct + ?, total_wrong = total_wrong + ?,
           last_seen_at = ?, last_result = ? WHERE user_id = ? AND question_id = ?`
        ).bind(updated.srsLevel, updated.easeFactor, updated.intervalDays, updated.nextReviewAt,
          answer.correct ? 1 : 0, answer.correct ? 0 : 1, now, answer.correct ? 1 : 0, userId, answer.itemId)
      )
    } else {
      updateStatements.push(
        c.env.DB.prepare(
          `INSERT INTO user_grammar_progress (user_id, question_id, srs_level, ease_factor, interval_days, next_review_at, total_seen, total_correct, total_wrong, last_seen_at, last_result)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
        ).bind(userId, answer.itemId, updated.srsLevel, updated.easeFactor, updated.intervalDays, updated.nextReviewAt,
          answer.correct ? 1 : 0, answer.correct ? 0 : 1, now, answer.correct ? 1 : 0)
      )
    }
  }

  for (const answer of phraseAnswers) {
    const existing = phraseExisting.get(answer.itemId)
    const current = existing || { srs_level: 0, ease_factor: 2.5, interval_days: 0 }
    const updated = calculateSrs(answer.correct, current.srs_level, current.ease_factor, current.interval_days)

    if (existing) {
      updateStatements.push(
        c.env.DB.prepare(
          `UPDATE user_phrase_progress SET srs_level = ?, ease_factor = ?, interval_days = ?, next_review_at = ?,
           total_seen = total_seen + 1, total_correct = total_correct + ?, total_wrong = total_wrong + ?,
           last_seen_at = ?, last_result = ? WHERE user_id = ? AND phrase_id = ?`
        ).bind(updated.srsLevel, updated.easeFactor, updated.intervalDays, updated.nextReviewAt,
          answer.correct ? 1 : 0, answer.correct ? 0 : 1, now, answer.correct ? 1 : 0, userId, answer.itemId)
      )
    } else {
      updateStatements.push(
        c.env.DB.prepare(
          `INSERT INTO user_phrase_progress (user_id, phrase_id, srs_level, ease_factor, interval_days, next_review_at, total_seen, total_correct, total_wrong, last_seen_at, last_result)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
        ).bind(userId, answer.itemId, updated.srsLevel, updated.easeFactor, updated.intervalDays, updated.nextReviewAt,
          answer.correct ? 1 : 0, answer.correct ? 0 : 1, now, answer.correct ? 1 : 0)
      )
    }
  }

  const wrongAnswerStmts = answers.filter(a => !a.correct).map(answer =>
    c.env.DB.prepare(
      'INSERT INTO wrong_answers (user_id, item_type, item_id, user_answer, correct_answer, created_at, mastered) VALUES (?, ?, ?, ?, ?, ?, 0)'
    ).bind(userId, answer.itemType, answer.itemId, answer.userAnswer || '', '', now)
  )

  const activityRow = await c.env.DB.prepare(
    'SELECT questions_answered, correct_count FROM daily_activity WHERE user_id = ? AND date = ?'
  ).bind(userId, today).first<{ questions_answered: number; correct_count: number }>()

  if (activityRow) {
    updateStatements.push(
      c.env.DB.prepare(
        'UPDATE daily_activity SET questions_answered = questions_answered + ?, correct_count = correct_count + ? WHERE user_id = ? AND date = ?'
      ).bind(totalQuestions, correctCount, userId, today)
    )
  } else {
    updateStatements.push(
      c.env.DB.prepare(
        'INSERT INTO daily_activity (user_id, date, questions_answered, correct_count) VALUES (?, ?, ?, ?)'
      ).bind(userId, today, totalQuestions, correctCount)
    )
  }

  updateStatements.push(
    c.env.DB.prepare(
      `INSERT INTO practice_sessions (id, user_id, mode, started_at, completed_at, total_questions, correct_count, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, userId, mode, now - 300, now, totalQuestions, correctCount, 300)
  )

  const streak = await c.env.DB.prepare('SELECT * FROM user_streaks WHERE user_id = ?')
    .bind(userId).first<{ current_streak: number; longest_streak: number; last_active_date: string; total_days: number }>()

  if (streak) {
    const lastDate = streak.last_active_date
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    let newStreak = streak.current_streak
    let totalDays = streak.total_days

    if (lastDate !== today) {
      totalDays++
      if (lastDate === yesterday) {
        newStreak++
      } else {
        newStreak = 1
      }
    }

    const longest = Math.max(streak.longest_streak, newStreak)
    updateStatements.push(
      c.env.DB.prepare(
        'UPDATE user_streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?, total_days = ? WHERE user_id = ?'
      ).bind(newStreak, longest, today, totalDays, userId)
    )
  } else {
    updateStatements.push(
      c.env.DB.prepare(
        'INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date, total_days) VALUES (?, 1, 1, ?, 1)'
      ).bind(userId, today)
    )
  }

  await c.env.DB.batch([...updateStatements, ...wrongAnswerStmts])

  return c.json({ correctCount, totalQuestions, rate: correctCount / totalQuestions })
})

const WORDS_PER_PAGE = 100

practiceRoutes.get('/words', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || '1'))
  const offset = (page - 1) * WORDS_PER_PAGE

  const [countResult, wordsResult] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as total FROM words').first<{ total: number }>(),
    c.env.DB.prepare(
      'SELECT word_id, word, phonetic, part_of_speech, definitions_json, collocation, secondary_meaning_note, difficulty FROM words ORDER BY frequency_rank ASC LIMIT ? OFFSET ?'
    ).bind(WORDS_PER_PAGE, offset).all(),
  ])

  const total = countResult?.total || 0
  const totalPages = Math.ceil(total / WORDS_PER_PAGE)

  const words = (wordsResult.results || []).map((w: any) => ({
    wordId: w.word_id,
    word: w.word,
    phonetic: w.phonetic,
    partOfSpeech: w.part_of_speech,
    definitions: JSON.parse(w.definitions_json || '{}'),
    collocation: w.collocation,
    secondaryMeaningNote: w.secondary_meaning_note,
    difficulty: w.difficulty,
  }))

  return c.json({ words, total, page, totalPages })
})
