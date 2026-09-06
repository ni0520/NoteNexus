import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  notes,
  noteBackups,
  type User,
  type InsertUser,
  type Note,
  type InsertNote,
  type BackupNote,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getNotes(userId: number): Promise<Note[]>;
  getNote(userId: number, id: number): Promise<Note | undefined>;
  createNote(userId: number, data: InsertNote): Promise<Note>;
  updateNote(userId: number, id: number, data: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(userId: number, id: number): Promise<boolean>;
  deleteAllNotes(userId: number): Promise<void>;
  importNotes(userId: number, data: Array<InsertNote & { createdAt?: Date; updatedAt?: Date }>): Promise<Note[]>;
  getBackups(userId: number): Promise<Array<{ id: number; createdAt: Date; noteCount: number }>>;
  createBackup(userId: number, data: BackupNote[]): Promise<typeof noteBackups.$inferSelect>;
  getBackup(userId: number, id: number): Promise<typeof noteBackups.$inferSelect | undefined>;
  deleteBackup(userId: number, id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getNotes(userId: number): Promise<Note[]> {
    return db.select().from(notes).where(eq(notes.userId, userId)).orderBy(notes.createdAt);
  }

  async getNote(userId: number, id: number): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    return note;
  }

  async createNote(userId: number, data: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes).values({ ...data, userId }).returning();
    return note;
  }

  async updateNote(userId: number, id: number, data: Partial<InsertNote>): Promise<Note | undefined> {
    const [note] = await db
      .update(notes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();
    return note;
  }

  async deleteNote(userId: number, id: number): Promise<boolean> {
    const result = await db.delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deleteAllNotes(userId: number): Promise<void> {
    await db.delete(notes).where(eq(notes.userId, userId));
  }

  async importNotes(userId: number, data: Array<InsertNote & { createdAt?: Date; updatedAt?: Date }>): Promise<Note[]> {
    await this.deleteAllNotes(userId);
    if (data.length === 0) return [];
    return db.insert(notes).values(data.map((note) => ({ ...note, userId }))).returning();
  }

  async getBackups(userId: number): Promise<Array<{ id: number; createdAt: Date; noteCount: number }>> {
    return db
      .select({
        id: noteBackups.id,
        createdAt: noteBackups.createdAt,
        noteCount: noteBackups.noteCount,
      })
      .from(noteBackups)
      .where(eq(noteBackups.userId, userId))
      .orderBy(noteBackups.createdAt);
  }

  async createBackup(userId: number, data: BackupNote[]): Promise<typeof noteBackups.$inferSelect> {
    const [backup] = await db
      .insert(noteBackups)
      .values({ userId, data, noteCount: data.length })
      .returning();
    return backup;
  }

  async getBackup(userId: number, id: number): Promise<typeof noteBackups.$inferSelect | undefined> {
    const [backup] = await db.select().from(noteBackups)
      .where(and(eq(noteBackups.id, id), eq(noteBackups.userId, userId)));
    return backup;
  }

  async deleteBackup(userId: number, id: number): Promise<boolean> {
    const result = await db.delete(noteBackups)
      .where(and(eq(noteBackups.id, id), eq(noteBackups.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
