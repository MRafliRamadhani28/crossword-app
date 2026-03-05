// src/lib/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const COOKIE_NAME = 'cw_session';

export interface SessionPayload {
  userId: string;
  name: string;
  role: string;
  playerId?: string;
  roomCode?: string;
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Helper for API routes to get current user
export async function requireAuth(request: Request): Promise<SessionPayload> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function requireRole(request: Request, roles: string[]): Promise<SessionPayload> {
  const session = await requireAuth(request);
  if (!roles.includes(session.role)) throw new Error('Forbidden');
  return session;
}
