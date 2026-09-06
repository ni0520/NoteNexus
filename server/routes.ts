import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertNoteSchema, importNoteSchema, insertUserSchema, type BackupNote } from "@shared/schema";
import { getUserId, hashPassword, publicUser, regenerateSession, requireAuth, destroySession, verifyPassword } from "./auth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const credentialsSchema = z.object({
    username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(8).max(128),
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
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
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(409).json({ message: "Username is already in use" });

      const user = await storage.createUser({
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
    if (!parsed.success) return res.status(400).json({ message: "Invalid username or password" });

    try {
      const user = await storage.getUserByUsername(parsed.data.username.toLowerCase());
      if (!user || !(await verifyPassword(parsed.data.password, user.password))) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
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
      const result = await storage.getNotes(getUserId(req));
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
      const note = await storage.createNote(getUserId(req), parsed.data);
      res.status(201).json(note);
    } catch (err) {
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const note = await storage.updateNote(getUserId(req), id, req.body);
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
      const deleted = await storage.deleteNote(getUserId(req), id);
      if (!deleted) return res.status(404).json({ message: "Note not found" });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  app.delete("/api/notes", async (req, res) => {
    try {
      await storage.deleteAllNotes(getUserId(req));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to clear notes" });
    }
  });

  app.post("/api/notes/import", async (req, res) => {
    const parsed = z.array(importNoteSchema).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    try {
      const result = await storage.importNotes(getUserId(req), parsed.data);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to import notes" });
    }
  });

  app.get("/api/backups", async (req, res) => {
    try {
      const result = await storage.getBackups(getUserId(req));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backups" });
    }
  });

  app.post("/api/backups", async (req, res) => {
    const parsed = z.object({ notes: z.array(importNoteSchema) }).safeParse(req.body);
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
      const backup = await storage.createBackup(getUserId(req), data);
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
      const backup = await storage.getBackup(getUserId(req), id);
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
      const restoredNotes = await storage.importNotes(getUserId(req), notesToRestore);
      res.json(restoredNotes);
    } catch (err) {
      res.status(500).json({ message: "Failed to restore backup" });
    }
  });

  app.delete("/api/backups/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const deleted = await storage.deleteBackup(getUserId(req), id);
      if (!deleted) return res.status(404).json({ message: "Backup not found" });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete backup" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
