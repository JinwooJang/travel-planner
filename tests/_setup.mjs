// Shared test setup: opens index.html from disk with a mock Google Maps (gmock.js), no network or API key needed.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
export const PAGE = new URL("../index.html", import.meta.url).href;
const MOCK = fileURLToPath(new URL("./gmock.js", import.meta.url));
let fails = 0;
export function check(ok, msg) { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) { fails++; process.exitCode = 1; } }
export async function start(storage = { date: "2026-10-15" }) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; });   // use plain downloads in tests
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ body: "", contentType: "text/css" }));
  await page.route("https://maps.googleapis.com/**", r => r.fulfill({ path: MOCK, contentType: "application/javascript" }));
  await page.goto(PAGE + "#plan");
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem("omanGmaps.key", "AIzaSyTESTKEY000000000000000000000000"); localStorage.setItem("omanGmaps.v1", JSON.stringify(s)); }, storage);
  await page.reload(); await page.waitForTimeout(1200);
  const finish = async () => { check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`); await browser.close(); console.log(fails ? `${fails} failed` : "all passed"); };
  return { page, browser, finish };
}
export const nodes = page => page.$$eval(".tl .stop .body > b", e => e.map(x => x.textContent));
export async function openPlan(page, text) {
  const id = await page.$eval("#planSel", (s, t) => [...s.options].find(o => o.textContent.includes(t)).value, text);
  await page.selectOption("#planSel", id); await page.waitForTimeout(400);
}
export async function rightClickMap(page, lat, lng) {
  await page.evaluate(([lat, lng]) => window.__mockMap.ls.contextmenu({ latLng: { lat: () => lat, lng: () => lng }, domEvent: { clientX: 420, clientY: 380 } }), [lat, lng]);
  await page.waitForTimeout(80);
  return page.$$eval(".ctxmenu .cx-i", e => e.map(x => (x.classList.contains("primary") ? "*" : "") + x.textContent.replace(/\s+/g, " ").trim()));
}
