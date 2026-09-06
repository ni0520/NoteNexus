import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import session from "express-session";
import { noteBackups, type BackupNote, type InsertNote, type Note, type User } from "@shared/schema";
import { registerRoutes } from "./routes";
import type { IStorage } from "./storage";

const password = "test-password-123";

class MemoryStorage implements IStorage {
  private nextUserId = 1;
  private nextNoteId = 1;
  private nextBackupId = 1;
  private readonly userRecords: User[] = [];
  private readonly noteRecords: Note[] = [];
  private readonly backupRecords: Array<typeof noteBackups.$inferSelect> = [];

  async getUser(id: number): Promise<User | undefined> {
    return this.userRecords.find((user) => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.userRecords.find((user) => user.username === username);
  }

  async createUser(user: { username: string; password: string }): Promise<User> {
    const created = { id: this.nextUserId++, ...user };
    this.userRecords.push(created);
    return created;
  }

  async getNotes(userId: number): Promise<Note[]> {
    return this.noteRecords.filter((note) => note.userId === userId);
  }

  async getNote(userId: number, id: number): Promise<Note | undefined> {
    return this.noteRecords.find((note) => note.userId === userId && note.id === id);
  }

  async createNote(userId: number, data: InsertNote): Promise<Note> {
    const now = new Date();
    const note = { id: this.nextNoteId++, userId, ...data, createdAt: now, updatedAt: now };
    this.noteRecords.push(note);
    return note;
  }

  async updateNote(userId: number, id: number, data: Partial<InsertNote>): Promise<Note | undefined> {
    const note = await this.getNote(userId, id);
    if (!note) return undefined;
    Object.assign(note, data, { updatedAt: new Date() });
    return note;
  }

  async deleteNote(userId: number, id: number): Promise<boolean> {
    const index = this.noteRecords.findIndex((note) => note.userId === userId && note.id === id);
    if (index < 0) return false;
    this.noteRecords.splice(index, 1);
    return true;
  }

  async deleteAllNotes(userId: number): Promise<void> {
    for (let index = this.noteRecords.length - 1; index >= 0; index -= 1) {
      if (this.noteRecords[index].userId === userId) this.noteRecords.splice(index, 1);
    }
  }

  async importNotes(
    userId: number,
    data: Array<InsertNote & { createdAt?: Date; updatedAt?: Date }>,
  ): Promise<Note[]> {
    await this.deleteAllNotes(userId);
    const imported: Note[] = [];
    for (const noteData of data) {
      const now = new Date();
      const note = {
        id: this.nextNoteId++,
        userId,
        ...noteData,
        createdAt: noteData.createdAt ?? now,
        updatedAt: noteData.updatedAt ?? now,
      };
      this.noteRecords.push(note);
      imported.push(note);
    }
    return imported;
  }

  async getBackups(userId: number): Promise<Array<{ id: number; createdAt: Date; noteCount: number }>> {
    return this.backupRecords
      .filter((backup) => backup.userId === userId)
      .map(({ id, createdAt, noteCount }) => ({ id, createdAt, noteCount }));
  }

  async createBackup(userId: number, data: BackupNote[]): Promise<typeof noteBackups.$inferSelect> {
    const backup = {
      id: this.nextBackupId++,
      userId,
      createdAt: new Date(),
      noteCount: data.length,
      data,
    };
    this.backupRecords.push(backup);
    return backup;
  }

  async getBackup(userId: number, id: number): Promise<typeof noteBackups.$inferSelect | undefined> {
    return this.backupRecords.find((backup) => backup.userId === userId && backup.id === id);
  }

  async deleteBackup(userId: number, id: number): Promise<boolean> {
    const index = this.backupRecords.findIndex((backup) => backup.userId === userId && backup.id === id);
    if (index < 0) return false;
    this.backupRecords.splice(index, 1);
    return true;
  }
}

type ApiNote = Omit<Note, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

class ApiClient {
  private cookie?: string;

  constructor(private readonly url: string) {}

  async request(path: string, options: { method?: string; body?: unknown } = {}): Promise<Response> {
    const headers = new Headers();
    if (this.cookie) headers.set("cookie", this.cookie);

    const request: RequestInit = { method: options.method, headers };
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      request.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.url}${path}`, request);
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    return response;
  }
}

async function expectStatus(response: Response, status: number): Promise<void> {
  if (response.status !== status) {
    assert.fail(`Expected status ${status}, received ${response.status}: ${await response.text()}`);
  }
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function register(client: ApiClient, username: string): Promise<void> {
  const response = await client.request("/api/auth/register", {
    method: "POST",
    body: { username, password },
  });
  await expectStatus(response, 201);
}

let server: Server;
let baseUrl: string;
let nextUsername = 1;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "test-only-session-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );

  server = await registerRoutes(app, new MemoryStorage());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("imports valid notes, applies defaults, and rejects malformed payloads", async () => {
  const client = new ApiClient(baseUrl);
  await register(client, `import-test-${nextUsername++}`);

  const createdAt = "2026-09-05T12:30:00.000Z";
  const updatedAt = "2026-09-06T12:30:00.000Z";
  const validResponse = await client.request("/api/notes/import", {
    method: "POST",
    body: [
      {
        text: "A dated note",
        tags: [{ name: "release", color: "blue" }],
        createdAt,
        updatedAt,
        isLocked: true,
        isHidden: false,
        isPinned: true,
        color: "yellow",
      },
      { text: "A note using defaults" },
    ],
  });
  await expectStatus(validResponse, 201);
  const imported = await json<ApiNote[]>(validResponse);

  assert.equal(imported.length, 2);
  assert.equal(new Date(imported[0].createdAt).toISOString(), createdAt);
  assert.equal(new Date(imported[0].updatedAt).toISOString(), updatedAt);
  assert.deepEqual(imported[0].tags, [{ name: "release", color: "blue" }]);
  assert.equal(imported[0].isLocked, true);
  assert.equal(imported[0].isPinned, true);
  assert.equal(imported[1].text, "A note using defaults");
  assert.deepEqual(imported[1].tags, []);
  assert.equal(imported[1].isLocked, false);
  assert.equal(imported[1].isHidden, false);
  assert.equal(imported[1].isPinned, false);
  assert.equal(imported[1].color, "");

  const malformedPayloads: unknown[] = [
    { text: "not an array" },
    [{ tags: [] }],
    [{ text: "" }],
    [{ text: "invalid date", createdAt: "not-a-date" }],
    [{ text: "invalid tag", tags: [{ name: "missing color" }] }],
    [{ text: "invalid flag", isPinned: "true" }],
  ];
  for (const body of malformedPayloads) {
    await expectStatus(
      await client.request("/api/notes/import", { method: "POST", body }),
      400,
    );
  }

  const unchangedResponse = await client.request("/api/notes");
  await expectStatus(unchangedResponse, 200);
  assert.deepEqual(
    (await json<ApiNote[]>(unchangedResponse)).map((note) => note.text),
    ["A dated note", "A note using defaults"],
  );
});

test("creates and restores backups with dates, defaults, and malformed payload protection", async () => {
  const client = new ApiClient(baseUrl);
  await register(client, `backup-test-${nextUsername++}`);

  const createdAt = "2026-09-01T08:00:00.000Z";
  const updatedAt = "2026-09-02T08:00:00.000Z";
  const backupResponse = await client.request("/api/backups", {
    method: "POST",
    body: {
      notes: [
        {
          text: "Restored with metadata",
          tags: [{ name: "backup", color: "green" }],
          createdAt,
          updatedAt,
          isLocked: true,
          isHidden: true,
          isPinned: false,
          color: "green",
        },
        { text: "Restored with defaults" },
      ],
    },
  });
  await expectStatus(backupResponse, 201);
  const backup = await json<{ id: number; createdAt: string; noteCount: number }>(backupResponse);
  assert.equal(backup.noteCount, 2);
  assert.ok(Number.isNaN(Date.parse(backup.createdAt)) === false);

  const malformedPayloads: unknown[] = [
    {},
    { notes: "not an array" },
    { notes: [{ text: "" }] },
    { notes: [{ text: "invalid date", updatedAt: "not-a-date" }] },
    { notes: [{ text: "invalid tag", tags: [{ name: "missing color" }] }] },
  ];
  for (const body of malformedPayloads) {
    await expectStatus(
      await client.request("/api/backups", { method: "POST", body }),
      400,
    );
  }

  const restoreResponse = await client.request(`/api/backups/${backup.id}/restore`, { method: "POST" });
  await expectStatus(restoreResponse, 200);
  const restored = await json<ApiNote[]>(restoreResponse);
  assert.equal(restored.length, 2);
  assert.equal(new Date(restored[0].createdAt).toISOString(), createdAt);
  assert.equal(new Date(restored[0].updatedAt).toISOString(), updatedAt);
  assert.deepEqual(restored[0].tags, [{ name: "backup", color: "green" }]);
  assert.equal(restored[0].isLocked, true);
  assert.equal(restored[0].isHidden, true);
  assert.equal(restored[0].color, "green");
  assert.equal(restored[1].text, "Restored with defaults");
  assert.deepEqual(restored[1].tags, []);
  assert.equal(restored[1].isLocked, false);
  assert.equal(restored[1].isHidden, false);
  assert.equal(restored[1].isPinned, false);
  assert.equal(restored[1].color, "");
  assert.ok(Number.isNaN(Date.parse(restored[1].createdAt)) === false);
  assert.ok(Number.isNaN(Date.parse(restored[1].updatedAt)) === false);
});