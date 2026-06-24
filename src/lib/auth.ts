// Simple session management using cookies
// In production, replace with NextAuth.js or a proper auth library

import { cookies } from 'next/headers';
import type { SessionUser } from '@/types';

const SESSION_COOKIE = 'exhibition_session';

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;
  try {
    return JSON.parse(session.value) as SessionUser;
  } catch {
    return null;
  }
}

export function createSessionValue(user: SessionUser): string {
  return JSON.stringify(user);
}

// Simple hash comparison for demo (use bcrypt in production)
export function simpleHash(password: string): string {
  // Simple hash for demo purposes
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  // For demo: accept any password for seeded accounts
  if (hash.startsWith('$2b$10$dummy')) return true;
  return simpleHash(password) === hash;
}
