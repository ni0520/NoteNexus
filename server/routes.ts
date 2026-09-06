import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertNoteSchema, importNoteSchema, type BackupNote } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/notes", async (_req, res) => {
    try {
      const result = await storage.getNotes();
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
      const note = await storage.createNote(parsed.data);
      res.status(201).json(note);
    } catch (err) {
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const note = await storage.updateNote(id, req.body);
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
      const deleted = await storage.deleteNote(id);
      if (!deleted) return res.status(404).json({ message: "Note not found" });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  app.delete("/api/notes", async (_req, res) => {
    try {
      await storage.deleteAllNotes();
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
      const result = await storage.importNotes(parsed.data);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to import notes" });
    }
  });

  app.get("/api/backups", async (_req, res) => {
    try {
      const result = await storage.getBackups();
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
      const backup = await storage.createBackup(data);
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
      const backup = await storage.getBackup(id);
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
      const restoredNotes = await storage.importNotes(notesToRestore);
      res.json(restoredNotes);
    } catch (err) {
      res.status(500).json({ message: "Failed to restore backup" });
    }
  });

  app.delete("/api/backups/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const deleted = await storage.deleteBackup(id);
      if (!deleted) return res.status(404).json({ message: "Backup not found" });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete backup" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
