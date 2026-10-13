// The Vercel functions (api/) against an in-memory Supabase: password, plan upload, positions (OwnTracks and the planner), reading, ending.
import { installFakeSupabase, call, OWNER, VIEW_KEY } from "./fakebase.mjs";
const db = installFakeSupabase();
const { default: trip } = await import("../api/trip.js");
const { default: loc } = await import("../api/loc.js");
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) { fails++; process.exitCode = 1; } };
const bearer = { authorization: `Bearer ${OWNER}` }, basic = { authorization: "Basic " + Buffer.from(`me:${OWNER}`).toString("base64") };
const plan = { format: "oman-roadtrip-plan", version: 1, plans: [{ name: "가족 여행", pts: [{ ll: [55.3, 25.2], name: "두바이" }, { ll: [58.4, 23.6], name: "무스카트" }] }], routes: {} };

let r = await call(trip, { method: "GET", headers: { authorization: "Bearer wrong-password" } });
check(r.status === 401, "password check: a wrong password is refused");
r = await call(trip, { method: "GET", headers: bearer });
check(r.status === 200 && r.body.ok, "password check: the right password is accepted");
r = await call(trip, { method: "POST", body: { name: "x", data: plan } });
check(r.status === 401 && db.trips.length === 0, "uploading a plan needs the password");
r = await call(trip, { method: "POST", headers: bearer, body: { name: "x", data: { hello: 1 } } });
check(r.status === 400, "only plan-file data is accepted");
r = await call(trip, { method: "POST", headers: bearer, body: { name: "가족 여행", data: plan } });
const id = r.body.id;
check(r.status === 200 && /^[A-Za-z0-9_-]{16}$/.test(id) && db.trips.length === 1, "a new share gets an unguessable 16-character id");
const v1 = r.body.updated;
await new Promise(z => setTimeout(z, 5));
r = await call(trip, { method: "POST", headers: bearer, body: { id, name: "가족 여행 2", data: plan } });
check(r.status === 200 && r.body.id === id && db.trips.length === 1 && db.trips[0].name === "가족 여행 2" && r.body.updated !== v1, "uploading again with the id updates the same share");

r = await call(loc, { method: "POST", url: `/api/loc?trip=${id}`, body: { lat: 23.6, lng: 58.4 } });
check(r.status === 401 && db.locations.length === 0, "positions need the password");
r = await call(loc, { method: "POST", url: `/api/loc?trip=${id}`, headers: basic, body: { _type: "location", lat: 23.61, lon: 58.54, tst: 1792130000, acc: 12, vel: 88, cog: 120, batt: 80 } });
check(r.status === 200 && Array.isArray(r.body) && db.locations.length === 1 && db.locations[0].src === "owntracks" && db.locations[0].spd === 88, "OwnTracks (HTTP Basic) position is stored and answered with []");
r = await call(loc, { method: "POST", url: `/api/loc?trip=${id}`, headers: basic, body: { _type: "transition", event: "enter" } });
check(r.status === 200 && db.locations.length === 1, "other OwnTracks messages are ignored");
r = await call(loc, { method: "POST", url: `/api/loc?trip=${id}`, headers: bearer, body: { lat: 23.62, lng: 58.55, t: 1792130060000, acc: 8, spd: 90, hdg: 118 } });
check(r.status === 200 && db.locations.length === 2 && db.locations[1].src === "web", "the planner's position is stored");
r = await call(loc, { method: "POST", url: `/api/loc?trip=${id}`, headers: bearer, body: { lat: 123, lng: 58 } });
check(db.locations.length === 2, "impossible coordinates are dropped");
r = await call(loc, { method: "POST", url: `/api/loc?trip=nosuchtrip123`, headers: bearer, body: { lat: 23.6, lng: 58.4 } });
check(r.status === 404, "a position for a trip that isn't shared gets 404");

r = await call(trip, { method: "GET", url: `/api/trip?id=${id}` });
check(r.status === 200 && r.body.data.plans[0].name === "가족 여행" && r.body.track.length === 2 && r.body.track[0].lat === 23.61 && r.body.gkey === VIEW_KEY, "anyone with the link reads the plan, the track (oldest first) and the view-only map key");
check(!JSON.stringify(r.body).includes(OWNER) && !JSON.stringify(r.body).includes("service-role"), "no password or Supabase key in what viewers get");
const upd = r.body.updated, last = r.body.track[1].t;
r = await call(trip, { method: "GET", url: `/api/trip?id=${id}&v=${encodeURIComponent(upd)}&since=${encodeURIComponent(last)}` });
check(r.status === 200 && r.body.data === null && r.body.track.length === 0, "polling with v and since sends only what changed");
r = await call(trip, { method: "GET", url: `/api/trip?id=${encodeURIComponent("../etc")}` });
check(r.status === 400, "a malformed id is refused before touching the database");

r = await call(trip, { method: "DELETE", url: `/api/trip?id=${id}` });
check(r.status === 401 && db.trips.length === 1, "ending a share needs the password");
r = await call(trip, { method: "DELETE", url: `/api/trip?id=${id}`, headers: bearer });
check(r.status === 200 && db.trips.length === 0 && db.locations.length === 0, "ending a share deletes the trip and every position");
r = await call(trip, { method: "GET", url: `/api/trip?id=${id}` });
check(r.status === 404, "the link stops working");

delete process.env.SUPABASE_URL;
r = await call(trip, { method: "GET", url: `/api/trip?id=${id}` });
check(r.status === 500 && /Supabase/.test(r.body.error), "a missing server setting says what is missing");
console.log(fails ? `${fails} failed` : "all passed");
