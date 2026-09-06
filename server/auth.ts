import { promisify } from "node:util";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type session from "express-session";

const scryptAsync = promisify(scrypt);

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