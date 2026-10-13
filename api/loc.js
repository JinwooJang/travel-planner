// /api/loc?trip=<trip> — the traveller's position (password: Bearer, or HTTP Basic with any user name for OwnTracks).
// Body: OwnTracks' {_type:"location", lat, lon, tst, acc, vel(km/h), cog} or the planner's {lat, lng, t(ms), acc, spd(km/h), hdg}.
// Always answers a JSON array: OwnTracks (HTTP mode) reads the reply as a list of messages for the phone.
import { TRIP_RE, send, query, bodyOf, isOwner, db, fail } from "./_lib.js";

const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null);

export function point(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const ot = b._type !== undefined;
  if (ot && b._type !== "location") return null;                     // OwnTracks also posts other messages; those are ignored
  const lat = num(b.lat, -90, 90), lng = num(ot ? b.lon : b.lng, -180, 180);
  if (lat == null || lng == null) return null;
  const t = ot ? (num(b.tst, 1e9, 1e10) ? new Date(b.tst * 1000) : new Date()) : (num(b.t, 1e12, 1e14) ? new Date(b.t) : new Date());
  return { t: t.toISOString(), lat, lng, acc: num(b.acc, 0, 1e5), spd: num(ot ? b.vel : b.spd, 0, 1000), hdg: num(ot ? b.cog : b.hdg, 0, 360), src: ot ? "owntracks" : "web" };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "지원하지 않는 요청이에요" }); }
    if (!isOwner(req)) return send(res, 401, { error: "공유 비밀번호가 맞지 않아요" });
    const trip = query(req).trip;
    if (!TRIP_RE.test(trip || "")) return send(res, 400, { error: "주소에 ?trip=<공유 ID>가 필요해요" });
    const p = point(bodyOf(req));
    if (!p) return send(res, 200, []);
    try { await db("locations", { method: "POST", prefer: "return=minimal", body: [{ trip_id: trip, ...p }] }); }
    catch (e) { if (/23503|foreign key/i.test(e.db || e.message)) return send(res, 404, { error: "공유가 끝났거나 없는 여행이에요" }); throw e; }
    return send(res, 200, []);
  } catch (e) { return fail(res, e); }
}
