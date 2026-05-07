import { Hono } from 'hono'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'

export const userRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>()

userRoutes.use('*', authMiddleware)

userRoutes.get('/me', async (c) => {
  const userId = c.get('userId')

  const [user, settings] = await Promise.all([
    c.env.DB.prepare('SELECT id, email, display_name, avatar_url, email_verified, created_at, last_login_at FROM users WHERE id = ?')
      .bind(userId).first(),
    c.env.DB.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(userId).first(),
  ])

  if (!user) return c.json({ error: '使用者不存在' }, 404)

  return c.json({
    user: {
      id: (user as any).id,
      email: (user as any).email,
      displayName: (user as any).display_name,
      avatarUrl: (user as any).avatar_url,
      emailVerified: !!(user as any).email_verified,
      createdAt: (user as any).created_at,
    },
    settings: settings ? {
      accent: (settings as any).accent,
      theme: (settings as any).theme,
      dailyGoal: (settings as any).daily_goal,
      interfaceLang: (settings as any).interface_lang,
      definitionLang: (settings as any).definition_lang,
      showPhonetic: !!(settings as any).show_phonetic,
      showEtymology: !!(settings as any).show_etymology,
      autoPlayAudio: !!(settings as any).auto_play_audio,
      keyboardShortcuts: !!(settings as any).keyboard_shortcuts,
      level: (settings as any).level,
      learningGoal: (settings as any).learning_goal,
    } : null,
  })
})

userRoutes.patch('/settings', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const allowedFields: Record<string, string> = {
    accent: 'accent',
    theme: 'theme',
    dailyGoal: 'daily_goal',
    interfaceLang: 'interface_lang',
    definitionLang: 'definition_lang',
    showPhonetic: 'show_phonetic',
    showEtymology: 'show_etymology',
    autoPlayAudio: 'auto_play_audio',
    keyboardShortcuts: 'keyboard_shortcuts',
    level: 'level',
    learningGoal: 'learning_goal',
  }

  const updates: string[] = []
  const values: any[] = []

  for (const [key, column] of Object.entries(allowedFields)) {
    if (body[key] !== undefined) {
      updates.push(`${column} = ?`)
      values.push(typeof body[key] === 'boolean' ? (body[key] ? 1 : 0) : body[key])
    }
  }

  if (updates.length === 0) return c.json({ error: '沒有要更新的設定' }, 400)

  const existing = await c.env.DB.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').bind(userId).first()

  if (!existing) {
    await c.env.DB.prepare('INSERT INTO user_settings (user_id) VALUES (?)').bind(userId).run()
  }

  values.push(userId)
  await c.env.DB.prepare(
    `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`
  ).bind(...values).run()

  return c.json({ success: true })
})

userRoutes.patch('/profile', async (c) => {
  const userId = c.get('userId')
  const { displayName } = await c.req.json<{ displayName?: string }>()

  if (displayName !== undefined) {
    await c.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(displayName, userId).run()
  }

  return c.json({ success: true })
})

userRoutes.post('/avatar', async (c) => {
  const userId = c.get('userId')
  const formData = await c.req.formData()
  const file = formData.get('avatar') as File | null

  if (!file) return c.json({ error: '請選擇檔案' }, 400)

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) return c.json({ error: '檔案大小不得超過 2MB' }, 400)

  const ext = file.name.split('.').pop() || 'png'
  const key = `avatars/${userId}.${ext}`

  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const avatarUrl = `/api/user/avatar/${userId}.${ext}`
  await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(avatarUrl, userId).run()

  return c.json({ avatarUrl })
})

userRoutes.get('/avatar/:key', async (c) => {
  const key = `avatars/${c.req.param('key')}`
  const object = await c.env.R2.get(key)

  if (!object) return c.json({ error: 'Not found' }, 404)

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png')
  headers.set('Cache-Control', 'public, max-age=86400')

  return new Response(object.body, { headers })
})

userRoutes.post('/onboarding', async (c) => {
  const userId = c.get('userId')
  const { level, dailyGoal, learningGoal, accent } = await c.req.json<{
    level: string; dailyGoal: number; learningGoal: string; accent: string
  }>()

  await c.env.DB.prepare(
    `UPDATE user_settings SET level = ?, daily_goal = ?, learning_goal = ?, accent = ? WHERE user_id = ?`
  ).bind(level, dailyGoal, learningGoal, accent, userId).run()

  return c.json({ success: true })
})
