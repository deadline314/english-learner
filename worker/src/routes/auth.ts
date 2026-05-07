import { Hono } from 'hono'
import type { Env } from '../index'
import { hashPassword, verifyPassword, createToken } from '../services/auth'
import { rateLimiter } from '../middleware/auth'

export const authRoutes = new Hono<{ Bindings: Env }>()

authRoutes.post('/register', rateLimiter(5, 60), async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()

  if (!email || !password || password.length < 8) {
    return c.json({ error: '請提供有效的 email 和密碼（至少 8 字元）' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) {
    return c.json({ error: '此 email 已被註冊' }, 409)
  }

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  const now = Math.floor(Date.now() / 1000)

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, email_verified, created_at) VALUES (?, ?, ?, 0, ?)'
  ).bind(id, email, passwordHash, now).run()

  await c.env.DB.prepare(
    'INSERT INTO user_settings (user_id) VALUES (?)'
  ).bind(id).run()

  await c.env.DB.prepare(
    'INSERT INTO user_streaks (user_id, current_streak, longest_streak, total_days) VALUES (?, 0, 0, 0)'
  ).bind(id).run()

  const code = String(Math.floor(100000 + Math.random() * 900000))
  await c.env.KV.put(`verify:${id}`, `${code}:0`, { expirationTtl: 600 })

  const resendKey = c.env.RESEND_API_KEY
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: c.env.RESEND_FROM || 'noreply@example.com',
        to: [email],
        subject: 'English Learner - 驗證您的 Email',
        html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
          <h2 style="color:#4F46E5;">English Learner</h2>
          <p>您的驗證碼是：</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#F1F5F9;border-radius:8px;">${code}</div>
          <p style="color:#64748B;font-size:14px;">此驗證碼將在 10 分鐘後失效。</p>
        </div>`,
      }),
    })
  }

  return c.json({ userId: id, message: '驗證碼已發送至您的信箱' })
})

authRoutes.post('/verify', async (c) => {
  const { userId, code } = await c.req.json<{ userId: string; code: string }>()

  const stored = await c.env.KV.get(`verify:${userId}`)
  if (!stored) {
    return c.json({ error: '驗證碼已過期，請重新發送' }, 400)
  }

  const [storedCode, attemptsStr] = stored.split(':')
  const attempts = parseInt(attemptsStr)

  if (attempts >= 5) {
    await c.env.KV.delete(`verify:${userId}`)
    return c.json({ error: '嘗試次數過多，請重新發送驗證碼' }, 400)
  }

  if (code !== storedCode) {
    await c.env.KV.put(`verify:${userId}`, `${storedCode}:${attempts + 1}`, { expirationTtl: 600 })
    return c.json({ error: '驗證碼不正確' }, 400)
  }

  await c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(userId).run()
  await c.env.KV.delete(`verify:${userId}`)

  const token = await createToken(userId, c.env.JWT_SECRET)
  return c.json({ token, message: '驗證成功' })
})

authRoutes.post('/login', rateLimiter(10, 60), async (c) => {
  const { email, password, rememberMe } = await c.req.json<{ email: string; password: string; rememberMe?: boolean }>()

  const user = await c.env.DB.prepare('SELECT id, password_hash, email_verified FROM users WHERE email = ?')
    .bind(email).first<{ id: string; password_hash: string; email_verified: number }>()

  if (!user) {
    return c.json({ error: 'Email 或密碼不正確' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'Email 或密碼不正確' }, 401)
  }

  if (!user.email_verified) {
    return c.json({ error: '請先驗證您的 Email', userId: user.id, needsVerification: true }, 403)
  }

  const expiresIn = rememberMe ? '30d' : '7d'
  const token = await createToken(user.id, c.env.JWT_SECRET, expiresIn)

  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run()

  return c.json({ token })
})

authRoutes.post('/logout', async (c) => {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7)
    await c.env.KV.put(`blacklist:${token}`, '1', { expirationTtl: 604800 })
  }
  return c.json({ message: '已登出' })
})

authRoutes.post('/resend-code', rateLimiter(3, 60), async (c) => {
  const { userId } = await c.req.json<{ userId: string }>()

  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first<{ email: string }>()
  if (!user) return c.json({ error: '使用者不存在' }, 404)

  const code = String(Math.floor(100000 + Math.random() * 900000))
  await c.env.KV.put(`verify:${userId}`, `${code}:0`, { expirationTtl: 600 })

  const resendKey = c.env.RESEND_API_KEY
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: c.env.RESEND_FROM || 'noreply@example.com',
        to: [user.email],
        subject: 'English Learner - 驗證碼',
        html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
          <h2 style="color:#4F46E5;">English Learner</h2>
          <p>您的新驗證碼是：</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#F1F5F9;border-radius:8px;">${code}</div>
          <p style="color:#64748B;font-size:14px;">此驗證碼將在 10 分鐘後失效。</p>
        </div>`,
      }),
    })
  }

  return c.json({ message: '驗證碼已重新發送' })
})

authRoutes.post('/forgot-password', rateLimiter(3, 300), async (c) => {
  const { email } = await c.req.json<{ email: string }>()

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>()
  if (!user) {
    return c.json({ message: '若該信箱已註冊，重設連結將會寄出' })
  }

  const token = crypto.randomUUID()
  await c.env.KV.put(`reset:${token}`, user.id, { expirationTtl: 3600 })

  const resendKey = c.env.RESEND_API_KEY
  if (resendKey) {
    const resetUrl = `${c.env.FRONTEND_URL}/reset-password?token=${token}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: c.env.RESEND_FROM || 'noreply@example.com',
        to: [email],
        subject: 'English Learner - 重設密碼',
        html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
          <h2 style="color:#4F46E5;">English Learner</h2>
          <p>點擊下方連結重設密碼：</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px;">重設密碼</a>
          <p style="color:#64748B;font-size:14px;">此連結將在 1 小時後失效。</p>
        </div>`,
      }),
    })
  }

  return c.json({ message: '若該信箱已註冊，重設連結將會寄出' })
})

authRoutes.post('/reset-password', async (c) => {
  const { token, newPassword } = await c.req.json<{ token: string; newPassword: string }>()

  if (!newPassword || newPassword.length < 8) {
    return c.json({ error: '密碼至少 8 個字元' }, 400)
  }

  const userId = await c.env.KV.get(`reset:${token}`)
  if (!userId) {
    return c.json({ error: '重設連結已過期' }, 400)
  }

  const passwordHash = await hashPassword(newPassword)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, userId).run()
  await c.env.KV.delete(`reset:${token}`)

  return c.json({ message: '密碼已重設，請重新登入' })
})
