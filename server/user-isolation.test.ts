import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import session from "express-session";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { registerRoutes } from "./routes";
import type {
  BackupNote,
  InsertNote,
  Note,
  User,
} from "@shared/schema";
import { noteBackups } from "@shared/schema";
import type { IStorage } from "./storage";

const password = "test-password-123";
const runId = `${Date.now()}-${process.pid}`;

let server: Server;
let baseUrl: string;

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

const memoryStorage = new MemoryStorage();

class ApiClient {
  private cookie?: string;

  constructor(private readonly url: string, cookie?: string) {
    this.cookie = cookie;
  }

  get sessionCookie(): string | undefined {
    return this.cookie;
  }

  async request(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<Response> {
    const headers = new Headers();
    if (this.cookie) headers.set("cookie", this.cookie);

    const request: RequestInit = {
      method: options.method,
      headers,
    };
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

async function login(client: ApiClient, username: string, loginPassword = password): Promise<Response> {
  return client.request("/api/auth/login", {
    method: "POST",
    body: { username, password: loginPassword },
  });
}

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

  server = await registerRoutes(app, memoryStorage);
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

test("rejects every note and backup endpoint without a session", async () => {
  const client = new ApiClient(baseUrl);
  const requests = [
    ["/api/notes", "GET"],
    ["/api/notes", "POST", { text: "unauthenticated" }],
    ["/api/notes/999999", "PATCH", { text: "unauthenticated" }],
    ["/api/notes/999999", "DELETE"],
    ["/api/notes", "DELETE"],
    ["/api/notes/import", "POST", []],
    ["/api/backups", "GET"],
    ["/api/backups", "POST", { notes: [] }],
    ["/api/backups/999999", "DELETE"],
    ["/api/backups/999999/restore", "POST"],
  ] as const;

  for (const [path, method, body] of requests) {
    const response = await client.request(path, { method, body });
    await expectStatus(response, 401);
  }
});

test("keeps notes and backups isolated across users for every mutation", async () => {
  const alice = new ApiClient(baseUrl);
  const bob = new ApiClient(baseUrl);
  const aliceUsername = `isolation-alice-${runId}`;
  const bobUsername = `isolation-bob-${runId}`;
  await register(alice, aliceUsername);
  await register(bob, bobUsername);

  const aliceNoteResponse = await alice.request("/api/notes", {
    method: "POST",
    body: { text: "Alice original", tags: [{ name: "private", color: "red" }] },
  });
  await expectStatus(aliceNoteResponse, 201);
  const aliceNote = await json<{ id: number; text: string }>(aliceNoteResponse);

  const bobNoteResponse = await bob.request("/api/notes", {
    method: "POST",
    body: { text: "Bob original" },
  });
  await expectStatus(bobNoteResponse, 201);
  const bobNote = await json<{ id: number; text: string }>(bobNoteResponse);

  const aliceBackupResponse = await alice.request("/api/backups", {
    method: "POST",
    body: { notes: [{ text: "Alice backed up", tags: [], isLocked: false, isHidden: false, isPinned: false, color: "" }] },
  });
  await expectStatus(aliceBackupResponse, 201);
  const aliceBackup = await json<{ id: number }>(aliceBackupResponse);

  const bobBackupResponse = await bob.request("/api/backups", {
    method: "POST",
    body: { notes: [{ text: "Bob backed up", tags: [], isLocked: false, isHidden: false, isPinned: false, color: "" }] },
  });
  await expectStatus(bobBackupResponse, 201);
  const bobBackup = await json<{ id: number }>(bobBackupResponse);

  const aliceNotes = await alice.request("/api/notes");
  await expectStatus(aliceNotes, 200);
  assert.deepEqual((await json<Array<{ text: string }>>(aliceNotes)).map((note) => note.text), ["Alice original"]);

  const bobNotes = await bob.request("/api/notes");
  await expectStatus(bobNotes, 200);
  assert.deepEqual((await json<Array<{ text: string }>>(bobNotes)).map((note) => note.text), ["Bob original"]);

  const aliceBackups = await alice.request("/api/backups");
  await expectStatus(aliceBackups, 200);
  assert.deepEqual((await json<Array<{ id: number }>>(aliceBackups)).map((backup) => backup.id), [aliceBackup.id]);

  const bobBackups = await bob.request("/api/backups");
  await expectStatus(bobBackups, 200);
  assert.deepEqual((await json<Array<{ id: number }>>(bobBackups)).map((backup) => backup.id), [bobBackup.id]);

  for (const response of [
    await bob.request(`/api/notes/${aliceNote.id}`, { method: "PATCH", body: { text: "Bob hacked Alice" } }),
    await bob.request(`/api/notes/${aliceNote.id}`, { method: "DELETE" }),
    await bob.request(`/api/backups/${aliceBackup.id}/restore`, { method: "POST" }),
    await bob.request(`/api/backups/${aliceBackup.id}`, { method: "DELETE" }),
    await alice.request(`/api/notes/${bobNote.id}`, { method: "PATCH", body: { text: "Alice hacked Bob" } }),
    await alice.request(`/api/notes/${bobNote.id}`, { method: "DELETE" }),
    await alice.request(`/api/backups/${bobBackup.id}/restore`, { method: "POST" }),
    await alice.request(`/api/backups/${bobBackup.id}`, { method: "DELETE" }),
  ]) {
    await expectStatus(response, 404);
  }

  const unchangedAliceNoteResponse = await alice.request("/api/notes");
  await expectStatus(unchangedAliceNoteResponse, 200);
  assert.equal((await json<Array<{ text: string }>>(unchangedAliceNoteResponse))[0]?.text, "Alice original");

  const unchangedBobNoteResponse = await bob.request("/api/notes");
  await expectStatus(unchangedBobNoteResponse, 200);
  assert.equal((await json<Array<{ text: string }>>(unchangedBobNoteResponse))[0]?.text, "Bob original");

  const updatedAliceResponse = await alice.request(`/api/notes/${aliceNote.id}`, {
    method: "PATCH",
    body: { text: "Alice changed" },
  });
  await expectStatus(updatedAliceResponse, 200);
  assert.equal((await json<{ text: string }>(updatedAliceResponse)).text, "Alice changed");

  const updatedBobResponse = await bob.request(`/api/notes/${bobNote.id}`, {
    method: "PATCH",
    body: { text: "Bob changed" },
  });
  await expectStatus(updatedBobResponse, 200);
  assert.equal((await json<{ text: string }>(updatedBobResponse)).text, "Bob changed");

  const restoredAliceResponse = await alice.request(`/api/backups/${aliceBackup.id}/restore`, { method: "POST" });
  await expectStatus(restoredAliceResponse, 200);
  const restoredAliceNotes = await json<Array<{ id: number; text: string }>>(restoredAliceResponse);
  assert.deepEqual(restoredAliceNotes.map((note) => note.text), ["Alice backed up"]);

  const restoredBobResponse = await bob.request(`/api/backups/${bobBackup.id}/restore`, { method: "POST" });
  await expectStatus(restoredBobResponse, 200);
  const restoredBobNotes = await json<Array<{ id: number; text: string }>>(restoredBobResponse);
  assert.deepEqual(restoredBobNotes.map((note) => note.text), ["Bob backed up"]);

  await expectStatus(
    await alice.request(`/api/notes/${restoredAliceNotes[0].id}`, { method: "DELETE" }),
    204,
  );
  await expectStatus(
    await bob.request(`/api/notes/${restoredBobNotes[0].id}`, { method: "DELETE" }),
    204,
  );
  await expectStatus(await alice.request(`/api/backups/${aliceBackup.id}`, { method: "DELETE" }), 204);
  await expectStatus(await bob.request(`/api/backups/${bobBackup.id}`, { method: "DELETE" }), 204);

  const emptyAliceNotes = await alice.request("/api/notes");
  await expectStatus(emptyAliceNotes, 200);
  assert.deepEqual(await json(emptyAliceNotes), []);
  const emptyBobNotes = await bob.request("/api/notes");
  await expectStatus(emptyBobNotes, 200);
  assert.deepEqual(await json(emptyBobNotes), []);
  const emptyAliceBackups = await alice.request("/api/backups");
  await expectStatus(emptyAliceBackups, 200);
  assert.deepEqual(await json(emptyAliceBackups), []);
  const emptyBobBackups = await bob.request("/api/backups");
  await expectStatus(emptyBobBackups, 200);
  assert.deepEqual(await json(emptyBobBackups), []);
});

test("invalidates the old session cookie after logout", async () => {
  const client = new ApiClient(baseUrl);
  const username = `logout-user-${runId}`;
  await register(client, username);
  const staleCookie = client.sessionCookie;
  assert.ok(staleCookie);

  await expectStatus(await client.request("/api/auth/logout", { method: "POST" }), 204);

  const staleSessionClient = new ApiClient(baseUrl, staleCookie);
  await expectStatus(await staleSessionClient.request("/api/notes"), 401);
  await expectStatus(await staleSessionClient.request("/api/backups"), 401);
});

test("throttles repeated login failures without revealing account existence", async () => {
  const username = `throttled-user-${runId}`;
  const registeredClient = new ApiClient(baseUrl);
  await register(registeredClient, username);

  const normalLogin = await login(new ApiClient(baseUrl), username);
  await expectStatus(normalLogin, 200);

  const attacker = new ApiClient(baseUrl);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectStatus(await login(attacker, username, "wrong-password"), 401);
  }

  const blockedResponse = await login(attacker, username, "wrong-password");
  await expectStatus(blockedResponse, 429);
  assert.equal((await json<{ message: string }>(blockedResponse)).message, "Invalid username or password");
  assert.ok(blockedResponse.headers.get("retry-after"));

  // A correct password is also rejected while the account-specific cooldown is active.
  await expectStatus(await login(attacker, username), 429);

  // Unknown accounts use the same generic response and are never identified by the limiter.
  const unknownResponse = await login(new ApiClient(baseUrl), `missing-user-${runId}`, "wrong-password");
  await expectStatus(unknownResponse, 401);
  assert.equal((await json<{ message: string }>(unknownResponse)).message, "Invalid username or password");
});
