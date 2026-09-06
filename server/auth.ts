import { promisify } from "node:util";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type session from "express-session";

const scryptAsync = promisify(scrypt);

export const INVALID_LOGIN_MESSAGE = "Invalid username or password";

const DUMMY_PASSWORD_HASH =
  "0123456789abcdef0123456789abcdef:c2d2ba183f543a9555794f9a82b7790c9785c638e679b8fb3f6eec5f77d3dac22a74cefc8101a11fbe1b6cffe9ca2aa4962b82388babd149c7d3b1f9a4c10059";

export interface LoginRateLimiterOptions {
  maxFailures?: number;
  windowMs?: number;
  lockoutMs?: number;
  maxEntries?: number;
  now?: () => number;
}

interface LoginAttemptState {
  failures: number;
  firstFailureAt: number;
  blockedUntil?: number;
}

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Tracks failed login attempts without persisting credentials or account data.
 * A separate limiter can be used for a source-wide and account-specific key.
 */
export class LoginRateLimiter {
  private readonly attempts = new Map<string, LoginAttemptState>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: LoginRateLimiterOptions = {}) {
    this.maxFailures = options.maxFailures ?? 5;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
    this.lockoutMs = options.lockoutMs ?? 60 * 1000;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  check(key: string): LoginRateLimitResult {
    const now = this.now();
    const state = this.attempts.get(key);
    if (!state) return { allowed: true };

    if (state.blockedUntil && state.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((state.blockedUntil - now) / 1000)),
      };
    }

    if (
      (state.blockedUntil && state.blockedUntil <= now) ||
      now - state.firstFailureAt >= this.windowMs
    ) {
      this.attempts.delete(key);
    }

    return { allowed: true };
  }

  recordFailure(key: string): void {
    const now = this.now();
    const existing = this.attempts.get(key);
    const state =
      !existing ||
      (existing.blockedUntil && existing.blockedUntil <= now) ||
      now - existing.firstFailureAt >= this.windowMs
        ? { failures: 0, firstFailureAt: now }
        : existing;

    state.failures += 1;
    if (state.failures >= this.maxFailures) {
      state.blockedUntil = now + this.lockoutMs;
    }
    this.attempts.set(key, state);
    this.pruneExpiredEntries(now);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private pruneExpiredEntries(now: number): void {
    if (this.attempts.size <= this.maxEntries) return;

    this.attempts.forEach((state, key) => {
      if (
        (!state.blockedUntil || state.blockedUntil <= now) &&
        now - state.firstFailureAt >= this.windowMs
      ) {
        this.attempts.delete(key);
      }
    });
    if (this.attempts.size <= this.maxEntries) return;

    // Keep the limiter bounded even if an attacker keeps sending unique keys.
    const oldestKey = this.attempts.keys().next().value;
    if (oldestKey !== undefined) this.attempts.delete(oldestKey);
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex || !/^[0-9a-f]+$/i.test(keyHex) || keyHex.length % 2 !== 0) return false;

  const storedKey = Buffer.from(keyHex, "hex");
  if (storedKey.length === 0) return false;
  const derivedKey = (await scryptAsync(password, salt, storedKey.length)) as Buffer;
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

export async function verifyPasswordOrDummy(
  password: string,
  storedHash: string | undefined,
): Promise<boolean> {
  return verifyPassword(password, storedHash ?? DUMMY_PASSWORD_HASH);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  next();
}

export function getUserId(req: Request): number {
  if (!req.session.userId) {
    throw new Error("Authenticated user is missing from session");
  }
  return req.session.userId;
}

export function regenerateSession(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      req.session.userId = userId;
      resolve();
    });
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function publicUser(user: { id: number; username: string }) {
  return { id: user.id, username: user.username };
}