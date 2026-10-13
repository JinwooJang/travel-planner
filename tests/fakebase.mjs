// An in-memory stand-in for Supabase's REST API, just the calls api/ makes (trips, locations; eq / gt filters,
// order, limit, upsert, cascade delete, foreign key). It replaces global fetch for SUPABASE_URL only.
export const SB_URL = "https://fake-project.supabase.co", SB_KEY = "service-role-test", OWNER = "test-owner-password", VIEW_KEY = "AIzaVIEWONLYKEY";

export function installFakeSupabase() {
  Object.assign(process.env, { SUPABASE_URL: SB_URL, SUPABASE_SERVICE_KEY: SB_KEY, OWNER_TOKEN: OWNER, GMAPS_VIEW_KEY: VIEW_KEY });
  const db = { trips: [], locations: [], seq: 0, calls: [] };
  const real = globalThis.fetch;
  const reply = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (url, opt = {}) => {
    if (!String(url).startsWith(SB_URL)) return real(url, opt);
    const h = opt.headers || {};
    if (h.apikey !== SB_KEY || h.Authorization !== `Bearer ${SB_KEY}`) return reply(401, { message: "bad key" });
    const u = new URL(url), table = u.pathname.replace("/rest/v1/", ""), rows = db[table], method = opt.method || "GET";
    db.calls.push(`${method} ${table}${u.search}`);
    if (!Array.isArray(rows)) return reply(404, { message: "no table" });
    const filters = [...u.searchParams].filter(([k]) => !["select", "order", "limit"].includes(k));
    const match = r => filters.every(([k, v]) => { const [op, ...rest] = v.split("."), val = rest.join(".");
      return op === "eq" ? String(r[k]) === val : op === "gt" ? Date.parse(r[k]) > Date.parse(val) : false; });
    if (method === "GET") {
      let out = rows.filter(match);
      const ord = u.searchParams.get("order");
      if (ord) { const [k, dir] = ord.split("."); out.sort((a, b) => (Date.parse(a[k]) - Date.parse(b[k])) * (dir === "desc" ? -1 : 1)); }
      if (u.searchParams.get("limit")) out = out.slice(0, +u.searchParams.get("limit"));
      const sel = (u.searchParams.get("select") || "").split(",").filter(Boolean);
      return reply(200, out.map(r => sel.length ? Object.fromEntries(sel.map(k => [k, r[k]])) : r));
    }
    if (method === "POST") {
      const items = JSON.parse(opt.body);
      for (const it of items) {
        if (table === "trips") {
          const old = rows.find(r => r.id === it.id);
          if (old && !String(h.Prefer || "").includes("merge-duplicates")) return reply(409, { code: "23505" });
          if (old) Object.assign(old, it); else rows.push({ created_at: new Date().toISOString(), ...it });
        } else {
          if (!db.trips.some(t => t.id === it.trip_id)) return reply(409, { code: "23503", message: "insert or update on table \"locations\" violates foreign key constraint" });
          rows.push({ id: ++db.seq, ...it });
        }
      }
      return reply(201, null);
    }
    if (method === "DELETE") {
      const gone = rows.filter(match);
      db[table] = rows.filter(r => !gone.includes(r));
      if (table === "trips") db.locations = db.locations.filter(l => !gone.some(t => t.id === l.trip_id));
      return reply(204, null);
    }
    return reply(405, null);
  };
  return db;
}

// a request / response pair shaped like Vercel's Node functions get
export function call(handler, { method = "GET", url = "/", headers = {}, body } = {}) {
  return new Promise(resolve => {
    const out = { status: 0, headers: {}, body: undefined };
    const res = {
      set statusCode(s) { out.status = s; }, get statusCode() { return out.status; },
      setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
      end(text) { out.body = text ? JSON.parse(text) : null; resolve(out); },
    };
    const query = Object.fromEntries(new URL(url, "http://local").searchParams);
    handler({ method, url, headers, query, body }, res);
  });
}
