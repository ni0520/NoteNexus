import { pgTable, text, serial, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  tags: jsonb("tags").$type<Array<{ name: string; color: string }>>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isLocked: boolean("is_locked").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  color: text("color").notNull().default(""),
});

const tagSchema = z.object({ name: z.string(), color: z.string() });

export const insertNoteSchema = z.object({
  text: z.string().min(1),
  tags: z.array(tagSchema).default([]),
  isLocked: z.boolean().default(false),
  isHidden: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  color: z.string().default(""),
});

export const importNoteSchema = insertNoteSchema.extend({
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
