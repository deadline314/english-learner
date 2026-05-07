import { Hono } from 'hono'
import type { Env } from '../index'
import { getAuthUser } from '../services/auth'

export const authMiddleware = async (c: any, next: () => Promise<void>) => {
  const userId = await getAuthUser(c)
  if (!userId) {
    return c.json({ error: '未授權' }, 401)
  }
  c.set('userId', userId)
  await next()
}

export const rateLimiter = (limit: number, windowSeconds: number) => {
  return async (c: any, next: () => Promise<void>) => {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown'
    const path = new URL(c.req.url).pathname
    const key = `ratelimit:${ip}:${path}`
    const current = await c.env.KV.get(key)
    const count = current ? parseInt(current) : 0

    if (count >= limit) {
      return c.json({ error: '請求過於頻繁，請稍後再試' }, 429)
    }

    await c.env.KV.put(key, String(count + 1), { expirationTtl: windowSeconds })
    await next()
  }
}
