import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, type IStorage } from "./storage";
import {
  createBackupSchema,
  importNotesSchema,
  insertNoteSchema,
  insertUserSchema,
  type BackupNote,
} from "@shared/schema";
import {
  destroySession,
  getUserId,
  hashPassword,
  INVALID_LOGIN_MESSAGE,
  LoginRateLimiter,
  publicUser,
  regenerateSession,
  requireAuth,
  verifyPasswordOrDummy,
} from "./auth";
import { z } from "zod/v4";

export async function registerRoutes(app: Express, storageImplementation: IStorage = storage): Promise<Server> {
  const loginIpLimiter = new LoginRateLimiter({ maxFailures: 20 });
  const loginAccountLimiter = new LoginRateLimiter();
  const credentialsSchema = z.object({
    username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(8).max(128),
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storageImplementation.getUser(req.session.userId);
    if (!user) {
      await destroySession(req);
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(publicUser(user));
  });

  app.post("/api/auth/register", async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    try {
      const username = parsed.data.username.toLowerCase();
      const existingUser = await storageImplementation.getUserByUsername(username);
      if (existingUser) return res.status(409).json({ message: "Username is already in use" });

      const user = await storageImplementation.createUser({
        ...insertUserSchema.parse({ username, password: parsed.data.password }),
        password: await hashPassword(parsed.data.password),
      });
      await regenerateSession(req, user.id);
      res.status(201).json(publicUser(user));
    } catch (err) {
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: INVALID_LOGIN_MESSAGE });

    try {
      const username = parsed.data.username.toLowerCase();
      const sourceKey = req.ip || req.socket.remoteAddress || "unknown";
      const accountKey = `${sourceKey}:${username}`;
      const blocked = [loginIpLimiter.check(sourceKey), loginAccountLimiter.check(accountKey)]
        .filter((result) => !result.allowed)
        .sort((a, b) => (b.retryAfterSeconds ?? 0) - (a.retryAfterSeconds ?? 0))[0];

      if (blocked) {
        res.set("Retry-After", String(blocked.retryAfterSeconds ?? 60));
        return res.status(429).json({ message: INVALID_LOGIN_MESSAGE });
      }

      const user = await storageImplementation.getUserByUsername(username);
      const passwordMatches = await verifyPasswordOrDummy(parsed.data.password, user?.password);
      if (!user || !passwordMatches) {
        loginIpLimiter.recordFailure(sourceKey);
        loginAccountLimiter.recordFailure(accountKey);
        return res.status(401).json({ message: INVALID_LOGIN_MESSAGE });
      }

      loginIpLimiter.reset(sourceKey);
      loginAccountLimiter.reset(accountKey);
      await regenerateSession(req, user.id);
      res.json(publicUser(user));
    } catch (err) {
      res.status(500).json({ message: "Failed to sign in" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await destroySession(req);
      res.clearCookie("connect.sid");
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to sign out" });
    }
  });

  app.use("/api/notes", requireAuth);
  app.use("/api/backups", requireAuth);

  app.get("/api/notes", async (req, res) => {
    try {
      const result = await storageImplementation.getNotes(getUserId(req));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    try {
      const note = await storageImplementation.createNote(getUserId(req), parsed.data);
      res.status(201).json(note);
    } catch (err) {
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const note = await storageImplementation.updateNote(getUserId(req), id, req.body);
      if (!note) return res.status(404).json({ message: "Note not found" });
      res.json(note);
    } catch (err) {
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const deleted = await storageImplementation.deleteNote(getUserId(req), id);
      if (!deleted) return res.status(404).json({ message: "Note not found" });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  app.delete("/api/notes", async (req, res) => {
    try {
      await storageImplementation.deleteAllNotes(getUserId(req));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to clear notes" });
    }
  });

  app.post("/api/notes/import", async (req, res) => {
    const parsed = importNotesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    try {
      const result = await storageImplementation.importNotes(getUserId(req), parsed.data);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to import notes" });
    }
  });

  app.get("/api/backups", async (req, res) => {
    try {
      const result = await storageImplementation.getBackups(getUserId(req));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backups" });
    }
  });

  app.post("/api/backups", async (req, res) => {
    const parsed = createBackupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    try {
      const data: BackupNote[] = parsed.data.notes.map((note) => ({
        text: note.text,
        tags: note.tags,
        createdAt: note.createdAt?.toISOString(),
        updatedAt: note.updatedAt?.toISOString(),
        isLocked: note.isLocked,
        isHidden: note.isHidden,
        isPinned: note.isPinned,
        color: note.color,
      }));
      const backup = await storageImplementation.createBackup(getUserId(req), data);
      res.status(201).json({
        id: backup.id,
        createdAt: backup.createdAt,
        noteCount: backup.noteCount,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to create backup" });
    }
  });

  app.post("/api/backups/:id/restore", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const backup = await storageImplementation.getBackup(getUserId(req), id);
      if (!backup) return res.status(404).json({ message: "Backup not found" });

      const notesToRestore = backup.data.map((note) => ({
        text: note.text,
        tags: note.tags,
        isLocked: note.isLocked,
        isHidden: note.isHidden,
        isPinned: note.isPinned,
        color: note.color,
        createdAt: note.createdAt ? new Date(note.createdAt) : undefined,
        updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined,
      }));
      const restoredNotes = await storageImplementation.importNotes(getUserId(req), notesToRestore);
      res.json(restoredNotes);
    } catch (err) {
      res.status(500).json({ message: "Failed to restore backup" });
    }
  });

  app.delete("/api/backups/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const deleted = await storageImplementation.deleteBackup(getUserId(req), id);
      if (!deleted) return res.status(404).json({ message: "Backup not found" });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete backup" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
