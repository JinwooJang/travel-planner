// Shared helpers for the Vercel functions (files starting with "_" are not routes).
// Secrets come only from the environment (Vercel → Project → Settings → Environment Variables), never from the repo:
//   SUPABASE_URL          https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY  service_role key — stays on the server; browsers never see it
//   OWNER_TOKEN           the sharing password (planner and OwnTracks send it)
//   GMAPS_VIEW_KEY        view-only Google key (Maps JavaScript API only, limited to this site) for people opening a share link
import crypto from "node:crypto";

export const TRIP_RE = /^[A-Za-z0-9_-]{8,40}$/;
export const newTripId = () => crypto.randomBytes(12).toString("base64url");   // 16 characters, unguessable

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function query(req) {
  if (req.query && typeof req.query === "object") return req.query;
  return Object.fromEntries(new URL(req.url || "/", "http://local").searchParams);
}

// JSON body as an object, or null (Vercel parses JSON bodies; reading a broken one throws)
export function bodyOf(req) {
  let b; try { b = req.body; } catch (e) { return null; }
  if (b == null || b === "") return null;
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") { try { return JSON.parse(b); } catch (e) { return null; } }
  return typeof b === "object" ? b : null;
}

// "Authorization: Bearer <password>" (planner) or HTTP Basic with any user name (OwnTracks)
export function isOwner(req) {
  const want = process.env.OWNER_TOKEN || "";
  if (want.length < 8) return false;
  const h = String((req.headers && req.headers.authorization) || "");
  let got = "";
  if (/^Bearer\s/i.test(h)) got = h.slice(7).trim();
  else if (/^Basic\s/i.test(h)) { const s = Buffer.from(h.slice(6).trim(), "base64").toString("utf8"); got = s.slice(s.indexOf(":") + 1); }
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Supabase REST (PostgREST) with the service_role key
export async function db(path, { method = "GET", body, prefer } = {}) {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, ""), key = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !key) throw Object.assign(new Error("서버에 Supabase 설정(SUPABASE_URL, SUPABASE_SERVICE_KEY)이 없어요"), { status: 500 });
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Supabase ${r.status}: ${text.slice(0, 300)}`), { status: 502, db: text });
  return text ? JSON.parse(text) : null;
}

export function fail(res, e) {
  return send(res, e && e.status || 500, { error: (e && e.message) || "서버 오류가 났어요" });
}
