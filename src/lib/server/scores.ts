// Backend skor minimal — SQLite via bun:sqlite.
//
// Lapisan: server. Hanya diimpor oleh Route Handler (src/app/api/*),
// JANGAN diimpor komponen client. Kontrak input divalidasi di sini supaya
// satu sumber kebenaran dipakai route + test.
//
// Yang disimpan: refId, userId anon, nama tampilan, skor 0..100, tier.
// Yang TIDAK disimpan: video, frame kamera, landmark (tetap di perangkat).
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { tierFor } from "../pose/scorer";

export interface ScoreInput {
  refId: string;
  userId: string;
  userName: string;
  score: number;
}

export interface ScoreEntry {
  id: number;
  refId: string;
  userId: string;
  userName: string;
  score: number;
  tier: string;
  createdAt: string;
}

const REF_ID_RE = /^[a-z0-9-]{1,32}$/;

function fail(msg: string): never {
  throw new Error(msg);
}

/** Validasi body POST /api/scores. Murni — bisa diuji tanpa DB. */
export function parseScoreInput(body: unknown): ScoreInput {
  if (typeof body !== "object" || body === null) fail("body harus objek JSON");
  const b = body as Record<string, unknown>;

  const refId = typeof b.refId === "string" ? b.refId.trim().toLowerCase() : "";
  if (!REF_ID_RE.test(refId)) fail("refId tidak valid");

  const userId = typeof b.userId === "string" ? b.userId.trim() : "";
  if (userId.length < 1 || userId.length > 64) fail("userId tidak valid");

  const userName = typeof b.userName === "string" ? b.userName.trim().replace(/\s+/g, " ") : "";
  if (userName.length < 1 || userName.length > 24) fail("nama 1..24 karakter");

  const rawScore = typeof b.score === "string" ? Number(b.score) : b.score;
  if (typeof rawScore !== "number" || !Number.isFinite(rawScore)) fail("score harus angka");
  const score = Math.round(rawScore);
  if (score < 0 || score > 100) fail("score 0..100");

  return { refId, userId, userName, score };
}

/** Validasi query GET /api/scores. Murni. */
export function parseBoardQuery(params: URLSearchParams): { refId: string; limit: number } {
  const refId = (params.get("refId") ?? "").trim().toLowerCase();
  if (!REF_ID_RE.test(refId)) fail("refId tidak valid");
  const raw = Number(params.get("limit") ?? "10");
  const limit = Number.isFinite(raw) ? Math.min(50, Math.max(1, Math.floor(raw))) : 10;
  return { refId, limit };
}

export function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      tier TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    );
    CREATE INDEX IF NOT EXISTS idx_scores_ref_score ON scores(ref_id, score DESC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_scores_ref_user ON scores(ref_id, user_id);
  `);
}

declare global {
  // Bun runtime mendukung global var untuk singleton DB.
  var __sanggarDb: Database | undefined;
}

/** Koneksi singleton. Path bisa dioverride via SANGGAR_DB_PATH (test/ops). */
export function getDb(): Database {
  if (globalThis.__sanggarDb) return globalThis.__sanggarDb;
  const path = process.env.SANGGAR_DB_PATH ?? "data/sanggar.db";
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  initSchema(db);
  globalThis.__sanggarDb = db;
  return db;
}

export function insertScore(db: Database, input: ScoreInput): ScoreEntry {
  const tier = tierFor(input.score);
  const row = db
    .query<
      { id: number; created_at: string },
      [string, string, string, number, string]
    >(
      `INSERT INTO scores (ref_id, user_id, user_name, score, tier)
       VALUES (?, ?, ?, ?, ?) RETURNING id, created_at`,
    )
    .get(input.refId, input.userId, input.userName, input.score, tier);
  if (!row) fail("gagal menyimpan skor");
  return {
    id: row.id,
    refId: input.refId,
    userId: input.userId,
    userName: input.userName,
    score: input.score,
    tier,
    createdAt: row.created_at,
  };
}

export interface BoardEntry {
  userName: string;
  score: number;
  tier: string;
  createdAt: string;
}

export function getTop(db: Database, refId: string, limit: number): BoardEntry[] {
  return db
    .query<BoardEntry, [string, number]>(
      `SELECT user_name AS userName, score, tier, created_at AS createdAt
       FROM scores WHERE ref_id = ?
       ORDER BY score DESC, created_at ASC LIMIT ?`,
    )
    .all(refId, limit);
}

export function getUserBest(db: Database, refId: string, userId: string): number | null {
  const row = db
    .query<{ best: number | null }, [string, string]>(
      `SELECT MAX(score) AS best FROM scores WHERE ref_id = ? AND user_id = ?`,
    )
    .get(refId, userId);
  return row?.best ?? null;
}

export function countScores(db: Database, refId: string): number {
  const row = db
    .query<{ n: number }, [string]>(`SELECT COUNT(*) AS n FROM scores WHERE ref_id = ?`)
    .get(refId);
  return row?.n ?? 0;
}
