// /api/trip — a shared trip: the plan (same JSON as an exported plan file) and the traveller's positions.
//   GET  ?id=<trip>[&v=<updated>][&since=<time>]  anyone with the link: plan (left out when v is current), new positions, view-only map key
//   GET  (no id, with password)                    checks the sharing password for the planner
//   POST {id?, name, data}   (password)            create or update; answers {id, updated}
//   DELETE ?id=<trip>        (password)            end sharing: the trip and all its positions are deleted
import { TRIP_RE, newTripId, send, query, bodyOf, isOwner, db, fail } from "./_lib.js";

const MAX_PLAN = 1500000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

export default async function handler(req, res) {
  try {
    const q = query(req);
    if (req.method === "GET") {
      if (!q.id) return isOwner(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: "공유 비밀번호가 맞지 않아요" });
      if (!TRIP_RE.test(q.id)) return send(res, 400, { error: "링크가 잘못됐어요" });
      const rows = await db(`trips?id=eq.${q.id}&select=id,name,data,updated_at`);
      if (!rows || !rows.length) return send(res, 404, { error: "공유가 끝났거나 링크가 잘못됐어요" });
      const t = rows[0], since = typeof q.since === "string" && ISO_RE.test(q.since) ? `&t=gt.${encodeURIComponent(q.since)}` : "";
      const pts = await db(`locations?trip_id=eq.${t.id}&select=t,lat,lng,acc,spd,hdg${since}&order=t.desc&limit=5000`);
      return send(res, 200, { id: t.id, name: t.name, updated: t.updated_at, data: q.v === t.updated_at ? null : t.data,
        track: (pts || []).reverse(), gkey: process.env.GMAPS_VIEW_KEY || null });
    }
    if (req.method !== "POST" && req.method !== "DELETE") { res.setHeader("Allow", "GET, POST, DELETE"); return send(res, 405, { error: "지원하지 않는 요청이에요" }); }
    if (!isOwner(req)) return send(res, 401, { error: "공유 비밀번호가 맞지 않아요" });
    if (req.method === "DELETE") {
      if (!TRIP_RE.test(q.id || "")) return send(res, 400, { error: "링크가 잘못됐어요" });
      await db(`trips?id=eq.${q.id}`, { method: "DELETE" });            // positions go with it (on delete cascade)
      return send(res, 200, { ok: true });
    }
    const b = bodyOf(req), d = b && b.data;
    if (!d || d.format !== "oman-roadtrip-plan" || !Array.isArray(d.plans)) return send(res, 400, { error: "플랜 데이터가 아니에요" });
    if (JSON.stringify(d).length > MAX_PLAN) return send(res, 413, { error: "플랜이 너무 커요" });
    const id = b.id == null ? newTripId() : String(b.id);
    if (!TRIP_RE.test(id)) return send(res, 400, { error: "공유 ID가 잘못됐어요" });
    const updated = new Date().toISOString();
    await db("trips", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
      body: [{ id, name: String(b.name || "").slice(0, 80), data: d, updated_at: updated }] });
    return send(res, 200, { id, updated });
  } catch (e) { return fail(res, e); }
}
