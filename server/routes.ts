import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertNoteSchema, importNoteSchema } from "@shared/schema";
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

  const httpServer = createServer(app);
  return httpServer;
}
