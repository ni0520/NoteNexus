import { eq } from "drizzle-orm";
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
  getNotes(): Promise<Note[]>;
  getNote(id: number): Promise<Note | undefined>;
  createNote(data: InsertNote): Promise<Note>;
  updateNote(id: number, data: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;
  deleteAllNotes(): Promise<void>;
  importNotes(data: Array<InsertNote & { createdAt?: Date; updatedAt?: Date }>): Promise<Note[]>;
  getBackups(): Promise<Array<{ id: number; createdAt: Date; noteCount: number }>>;
  createBackup(data: BackupNote[]): Promise<typeof noteBackups.$inferSelect>;
  getBackup(id: number): Promise<typeof noteBackups.$inferSelect | undefined>;
  deleteBackup(id: number): Promise<boolean>;
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

  async getNotes(): Promise<Note[]> {
    return db.select().from(notes).orderBy(notes.createdAt);
  }

  async getNote(id: number): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    return note;
  }

  async createNote(data: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes).values(data).returning();
    return note;
  }

  async updateNote(id: number, data: Partial<InsertNote>): Promise<Note | undefined> {
    const [note] = await db
      .update(notes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();
    return note;
  }

  async deleteNote(id: number): Promise<boolean> {
    const result = await db.delete(notes).where(eq(notes.id, id)).returning();
    return result.length > 0;
  }

  async deleteAllNotes(): Promise<void> {
    await db.delete(notes);
  }

  async importNotes(data: Array<InsertNote & { createdAt?: Date; updatedAt?: Date }>): Promise<Note[]> {
    await this.deleteAllNotes();
    if (data.length === 0) return [];
    return db.insert(notes).values(data).returning();
  }

  async getBackups(): Promise<Array<{ id: number; createdAt: Date; noteCount: number }>> {
    return db
      .select({
        id: noteBackups.id,
        createdAt: noteBackups.createdAt,
        noteCount: noteBackups.noteCount,
      })
      .from(noteBackups)
      .orderBy(noteBackups.createdAt);
  }

  async createBackup(data: BackupNote[]): Promise<typeof noteBackups.$inferSelect> {
    const [backup] = await db
      .insert(noteBackups)
      .values({ data, noteCount: data.length })
      .returning();
    return backup;
  }

  async getBackup(id: number): Promise<typeof noteBackups.$inferSelect | undefined> {
    const [backup] = await db.select().from(noteBackups).where(eq(noteBackups.id, id));
    return backup;
  }

  async deleteBackup(id: number): Promise<boolean> {
    const result = await db.delete(noteBackups).where(eq(noteBackups.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
