// Live sharing end to end: a local server runs the real api/ functions against an in-memory Supabase.
// The owner shares a plan and sends positions; a viewer with no key of their own opens the link.
import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { installFakeSupabase, OWNER, VIEW_KEY } from "./fakebase.mjs";
import { openPlan } from "./_setup.mjs";
const db = installFakeSupabase();
const { default: trip } = await import("../api/trip.js");
const { default: loc } = await import("../api/loc.js");
const HTML = fs.readFileSync(new URL("../index.html", import.meta.url));
const MOCK = fileURLToPath(new URL("./gmock.js", import.meta.url));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) { fails++; process.exitCode = 1; } };

// what Vercel does: /api/* → functions (JSON body parsed), /s/<id> and / → index.html
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://local");
  if (u.pathname.startsWith("/api/")) {
    let raw = ""; for await (const c of req) raw += c;
    req.query = Object.fromEntries(u.searchParams);
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch (e) { req.body = raw; }
    const fn = { "/api/trip": trip, "/api/loc": loc }[u.pathname];
    if (fn) return fn(req, res);
  } else if (u.pathname === "/" || /^\/s\/[\w-]+$/.test(u.pathname)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(HTML);
  }
  res.statusCode = 404; res.end("not found");
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const mapKeys = [];
async function open(path, storage) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ body: "", contentType: "text/css" }));
  await page.route("https://maps.googleapis.com/**", r => { mapKeys.push(new URL(r.request().url()).searchParams.get("key")); r.fulfill({ path: MOCK, contentType: "application/javascript" }); });
  if (storage) { await page.goto(BASE + "/"); await page.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, storage); }
  await page.goto(BASE + path); await page.reload(); await page.waitForTimeout(1200);    // reload: going from / to /#plan alone wouldn't load the page again
  return { page, errors };
}
const vis = (p, sel) => p.$$eval(sel, e => e.filter(x => x.checkVisibility()).length);

// ---- owner ----
const { page: o, errors: oErr } = await open("/#plan", { "omanGmaps.key": "AIzaSyOWNERKEY00000000000000000000000000", "omanGmaps.v1": JSON.stringify({ date: "2026-10-15" }) });
await openPlan(o, "차로만");
await o.click("#liveBox > summary");
check(await o.isVisible("#lvTok"), "owner: sharing first asks for the sharing password");
await o.fill("#lvTok", "wrong-password"); await o.click("#lvTokForm button[type=submit]"); await o.waitForTimeout(300);
check((await o.textContent("#liveBox .sh-msg")).includes("맞지 않아요") && await o.isVisible("#lvTok"), "owner: a wrong password is refused");
await o.fill("#lvTok", OWNER); await o.click("#lvTokForm button[type=submit]"); await o.waitForTimeout(300);
check(await o.isVisible("[data-lvstart]"), "owner: the right password lets the plan be shared");
await o.click("[data-lvstart]"); await o.waitForTimeout(400);
const link = await o.$eval("#lvUrl", e => e.value), id = link.split("/s/")[1], shared = () => db.trips[0] && db.trips[0].data.plans[0].pts.length;
check(link === `${BASE}/s/${id}` && /^[\w-]{16}$/.test(id) && db.trips.length === 1 && shared() > 5, "owner: sharing uploads the plan and shows the link");
await o.evaluate(() => {
  const g = { watchPosition(ok) { g.ok = ok; return 1; }, clearWatch() { g.ok = null; } };
  Object.defineProperty(navigator, "geolocation", { value: g, configurable: true });
  window.__fix = (lat, lng) => g.ok && g.ok({ timestamp: Date.now(), coords: { latitude: lat, longitude: lng, accuracy: 10, speed: 25, heading: 90 } });
});
await o.click("[data-lvsend]"); await o.evaluate(() => window.__fix(23.58, 58.38)); await o.waitForTimeout(400);
check(db.locations.length === 1 && db.locations[0].src === "web" && Math.round(db.locations[0].spd) === 90, "owner: this device's position goes up (km/h)");
await o.evaluate(() => window.__fix(23.5801, 58.3801)); await o.waitForTimeout(300);
check(db.locations.length === 1 && (await o.textContent("#lvSent")).includes("마지막 전송"), "owner: a tiny move within a minute isn't sent again; last send time shown");
const ot = await fetch(`${BASE}/api/loc?trip=${id}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from("me:" + OWNER).toString("base64") },
  body: JSON.stringify({ _type: "location", lat: 23.4, lon: 58.2, tst: Math.floor(Date.now() / 1000) + 2, vel: 95, cog: 200 }) });   // OwnTracks times are whole seconds: keep it clearly after the first
check(ot.status === 200 && JSON.stringify(await ot.json()) === "[]" && db.locations.length === 2, "OwnTracks (HTTP mode, Basic auth) posts a position");

// ---- viewer: a fresh browser with no key of its own ----
const { page: v, errors: vErr } = await open(`/s/${id}`);
check(await v.evaluate(() => document.body.classList.contains("sharing")), "viewer: the link opens the shared view");
check(mapKeys.at(-1) === VIEW_KEY && !(await v.isVisible("#keypanel")), "viewer: the map loads with the view-only key from the server, no key asked");
check(await v.$$eval("#map .gm.pp", e => e.length) === shared(), "viewer: every stop of the shared plan is on the map");
check((await v.textContent(".facts")).includes("10/15(목) 07:00"), "viewer: the departure date and time are the owner's, not today");
check(await vis(v, "[data-del],[data-ins],#planSel,#psearch,#liveBox,#keyBtn,#viewBtn,#days,#shareBox") === 0, "viewer: no planner tools at all");
const tv = () => v.evaluate(() => { const m = window.__ames.find(a => a.map && a.content.classList.contains("tv")); return m ? m.position : null; });
check((await tv()).lat === 23.4 && (await v.textContent(".livehead")).includes("방금") && (await v.textContent(".livehead")).includes("95km/h"), "viewer: the traveller is on the map with how fresh and how fast");
check(await v.evaluate(() => window.__polys.some(pl => pl.o.icons && pl.o.icons[0].repeat === "10px" && pl.o.path.length === 2)), "viewer: the track so far is drawn");
const menu = await v.evaluate(() => { window.__mockMap.ls.contextmenu({ latLng: { lat: () => 23, lng: () => 57 }, domEvent: { clientX: 420, clientY: 380 } }); return [...document.querySelectorAll(".ctxmenu .cx-i")].map(x => x.textContent); });
check(!menu.some(t => /추가|넣기|출발/.test(t)) && !(await v.$(".ctxmenu .cx-note")), "viewer: the map menu offers nothing to edit");
await v.keyboard.press("Escape");
await fetch(`${BASE}/api/loc?trip=${id}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${OWNER}` }, body: JSON.stringify({ lat: 23.1, lng: 57.9, t: Date.now() + 5000 }) });
await v.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await v.waitForTimeout(500);
check((await tv()).lat === 23.1 && await v.evaluate(() => window.__polys.some(pl => pl.o.icons && pl.o.icons[0].repeat === "10px" && pl.o.path.length === 3)), "viewer: a new position moves the marker and extends the track");

// ---- the owner edits: the link follows ----
const before = shared();
await o.click(".tl .stop [data-del]"); await o.waitForTimeout(3600);
check(shared() === before - 1, "owner: an edit reaches the shared plan a few seconds later");
await v.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await v.waitForTimeout(500);
check(await v.$$eval("#map .gm.pp", e => e.length) === before - 1, "viewer: sees the edit");
check(await v.evaluate(() => localStorage.getItem("omanGmaps.routes") === null && localStorage.getItem("omanGmaps.key") === null), "viewer: nothing of the shared trip is stored in the viewer's browser");

// ---- end sharing ----
await o.click("[data-lvend]"); await o.click("[data-lvend]"); await o.waitForTimeout(400);
check(db.trips.length === 0 && db.locations.length === 0 && await o.isVisible("[data-lvstart]"), "owner: ending the share deletes the plan and every position");
await v.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await v.waitForTimeout(500);
check((await v.textContent(".livehead")).includes("공유가 끝났어요"), "viewer: is told the share has ended");
const { page: late } = await open(`/s/${id}`);
check((await late.textContent(".sheet")).includes("공유가 끝났거나 링크가 잘못됐어요"), "a link opened after the end says so");

check(!oErr.length && !vErr.length, `no page errors${oErr.length || vErr.length ? ": " + [...oErr, ...vErr].join(" | ") : ""}`);
await browser.close(); server.close();
console.log(fails ? `${fails} failed` : "all passed");
