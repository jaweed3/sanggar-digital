// API skor minimal: POST menyimpan, GET papan teratas.
// Hanya angka + nama — video/landmark tidak pernah dikirim ke sini.
import {
  countScores,
  getDb,
  getTop,
  getUserBest,
  insertScore,
  parseBoardQuery,
  parseScoreInput,
} from "@/lib/server/scores";

export async function GET(request: Request) {
  try {
    const { refId, limit } = parseBoardQuery(new URL(request.url).searchParams);
    const db = getDb();
    const top = getTop(db, refId, limit);
    return Response.json({ refId, top, total: countScores(db, refId) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "gagal memuat papan skor";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body harus JSON" }, { status: 400 });
  }
  try {
    const input = parseScoreInput(body);
    const db = getDb();
    const entry = insertScore(db, input);
    const best = getUserBest(db, input.refId, input.userId);
    return Response.json({ entry, best }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "gagal menyimpan skor";
    return Response.json({ error: message }, { status: 400 });
  }
}
