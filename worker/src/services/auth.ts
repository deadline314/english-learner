import type { Env } from '../index'
import type { Context } from 'hono'
import { SignJWT, jwtVerify } from 'jose'

const ENCODER = new TextEncoder()
const ITERATIONS = 100000

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256
  )
  const hashArray = new Uint8Array(bits)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))
  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256
  )
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === hashHex
}

export async function createToken(userId: string, secret: string, expiresIn: string = '7d'): Promise<string> {
  const secretKey = ENCODER.encode(secret)
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey)
}

export async function verifyToken(token: string, secret: string): Promise<string | null> {
  try {
    const secretKey = ENCODER.encode(secret)
    const { payload } = await jwtVerify(token, secretKey)
    return payload.sub || null
  } catch {
    return null
  }
}

export async function getAuthUser(c: Context<{ Bindings: Env }>): Promise<string | null> {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const blacklisted = await c.env.KV.get(`blacklist:${token}`)
  if (blacklisted) return null
  return verifyToken(token, c.env.JWT_SECRET)
}
