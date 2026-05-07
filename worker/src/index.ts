import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './routes/auth'
import { practiceRoutes } from './routes/practice'
import { progressRoutes } from './routes/progress'
import { userRoutes } from './routes/user'

export interface Env {
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  ASSETS: Fetcher
  JWT_SECRET: string
  RESEND_API_KEY: string
  RESEND_FROM: string
  FRONTEND_URL: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

app.route('/api/auth', authRoutes)
app.route('/api/practice', practiceRoutes)
app.route('/api/progress', progressRoutes)
app.route('/api/user', userRoutes)

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
