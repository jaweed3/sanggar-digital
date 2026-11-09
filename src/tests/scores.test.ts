// Test backend skor minimal: validasi murni + SQLite in-memory.
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  countScores,
  getTop,
  getUserBest,
  initSchema,
  insertScore,
  parseBoardQuery,
  parseScoreInput,
} from "../lib/server/scores";

function memDb(): Database {
  const db = new Database(":memory:");
  initSchema(db);
  return db;
}

describe("parseScoreInput", () => {
  test("input valid lolos, nama dirapikan, skor dibulatkan", () => {
    const out = parseScoreInput({ refId: "Saman", userId: "u-1", userName: "  Sari  Putri ", score: 82.6 });
    expect(out).toEqual({ refId: "saman", userId: "u-1", userName: "Sari Putri", score: 83 });
  });

  test("refId aneh ditolak", () => {
    expect(() => parseScoreInput({ refId: "../x", userId: "u", userName: "A", score: 10 })).toThrow();
  });

  test("nama kosong / kepanjangan ditolak", () => {
    expect(() => parseScoreInput({ refId: "saman", userId: "u", userName: "  ", score: 10 })).toThrow();
    expect(() => parseScoreInput({ refId: "saman", userId: "u", userName: "x".repeat(25), score: 10 })).toThrow();
  });

  test("skor di luar 0..100 ditolak", () => {
    expect(() => parseScoreInput({ refId: "saman", userId: "u", userName: "A", score: 101 })).toThrow();
    expect(() => parseScoreInput({ refId: "saman", userId: "u", userName: "A", score: "NaN" })).toThrow();
  });
});

describe("parseBoardQuery", () => {
  test("default limit 10, clamp 1..50", () => {
    expect(parseBoardQuery(new URLSearchParams("refId=saman"))).toEqual({ refId: "saman", limit: 10 });
    expect(parseBoardQuery(new URLSearchParams("refId=saman&limit=999")).limit).toBe(50);
    expect(parseBoardQuery(new URLSearchParams("refId=saman&limit=0")).limit).toBe(1);
  });

  test("refId tak valid ditolak", () => {
    expect(() => parseBoardQuery(new URLSearchParams(""))).toThrow();
  });
});

describe("sqlite scores", () => {
  test("simpan lalu top terurut skor desc", () => {
    const db = memDb();
    insertScore(db, { refId: "saman", userId: "u1", userName: "Ayu", score: 70 });
    insertScore(db, { refId: "saman", userId: "u2", userName: "Bima", score: 90 });
    insertScore(db, { refId: "pendet", userId: "u3", userName: "Cici", score: 99 });
    const top = getTop(db, "saman", 10);
    expect(top.map((t) => t.userName)).toEqual(["Bima", "Ayu"]);
    expect(top[0].tier).toBe("HEBAT");
    expect(countScores(db, "saman")).toBe(2);
  });

  test("best per user = max", () => {
    const db = memDb();
    expect(getUserBest(db, "saman", "ghost")).toBeNull();
    insertScore(db, { refId: "saman", userId: "u1", userName: "Ayu", score: 60 });
    insertScore(db, { refId: "saman", userId: "u1", userName: "Ayu", score: 85 });
    expect(getUserBest(db, "saman", "u1")).toBe(85);
  });
});
