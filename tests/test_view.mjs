// View / edit switch (nothing can change in view mode) and the my-location dot (fake GPS, nothing stored).
import { start, check, nodes, openPlan, rightClickMap } from "./_setup.mjs";
const { page: p, finish } = await start();
await openPlan(p, "차로만");
const n0 = (await nodes(p)).length;
const vis = sel => p.$$eval(sel, e => e.filter(x => x.checkVisibility()).length);
const pins = () => p.evaluate(() => window.__ames.filter(m => m.map && m.content.classList.contains("pp")).map(m => m.draggable));
const EDIT = "[data-del],[data-up],[data-ins],[data-mode],[data-fly],[data-legpad],[data-pre],[data-undo],[data-clear],[data-saveas],[data-rename],[data-delplan],[data-loadc],[data-pick]";
check(await vis("[data-del]") > 0 && (await pins()).every(d => d), "edit mode: edit buttons shown, plan pins draggable");

// 표시 panel: every kind of map text on/off
const tog = async k => { if (await p.$eval("#visPop", e => e.hidden)) await p.click("#visBtn"); await p.click(`[data-disp="${k}"]`); };
const pressed = k => p.$eval(`[data-disp="${k}"]`, e => e.getAttribute("aria-pressed") === "true");
const marks = async () => ({ ticks: await vis("#map .gm.tick"), tm: await vis("#map .gm.tick .tm"), km: await vis("#map .gm.tick .km"), tn: await vis("#map .gm.tick .tn") });
let mk = await marks();
check(mk.ticks > 0 && mk.tm === mk.ticks && mk.km === mk.ticks && mk.tn > 0, "hourly marks show time, km and nearby town by default");
await tog("ttm");
mk = await marks();
check(mk.ticks > 0 && mk.tm === 0 && mk.km === mk.ticks && !(await pressed("ttm")), "hourly time off: km and town left");
await tog("tkm"); await tog("ttn");
check((await marks()).ticks === 0, "hourly time, km and town all off: no marks at all");
await tog("ttm");
mk = await marks();
check(mk.ticks > 0 && mk.km === 0 && mk.tn === 0 && await p.$$eval("#map .gm.tick .kmx", e => e.length && e.every(x => getComputedStyle(x).display === "none")), "time only: km and town hidden, km also in the hover detail");
await tog("tkm"); await tog("ttn");
// stop labels (plan pins): name / times / dates
const pin = async () => ({ lab: await vis("#map .gm.pp .lab"), nm: await vis("#map .gm.pp .nm"), tf: await vis("#map .gm.pp .tf"), td: await vis("#map .gm.pp .td"), dt: await vis("#map .gm.pp .tf .dt") });
let pl = await pin();
check(pl.lab > 0 && pl.nm === pl.lab && pl.tf === pl.lab && pl.td === 0 && pl.dt > 0, "pin labels: name + times, date in front when the day changes");
await tog("ldt");
pl = await pin();
check(pl.tf === pl.lab && pl.dt === 0, "date off: times without dates");
await tog("ltm");
pl = await pin();
check(pl.nm === pl.lab && pl.tf === 0 && pl.td === 0, "time and date off: names only");
await tog("ldt");
pl = await pin();
check(pl.td === pl.lab && pl.tf === 0 && /^\d+\/\d+\(.\)/.test(await p.$eval("#map .gm.pp .td", e => e.textContent)), "time off, date on: dates only");
await tog("lnm"); await tog("ldt");
check((await pin()).lab === 0, "name, time and date off: no pin labels");
await tog("leg"); await tog("pnm");
check(await vis("#map .gm.legchip") === 0, "leg number chips off");
await p.reload(); await p.waitForTimeout(1200);
check(await vis("#map .gm.pp .lab") === 0 && await vis("#map .gm.legchip") === 0 && await vis("#map .gm.tick") > 0, "display choices are remembered after reload");
await p.click("#visBtn"); await p.click("#dispNone");
check(await vis("#map .gm.tick") === 0 && await vis("#map .gm.pp .lab") === 0, "'글자 모두 끄기' hides every text");
check(await vis("#map .gm.pp .dot") > 0, "the pins themselves stay");
await p.click("#visReset");
check(await p.$$eval("[data-disp]", e => e.every(x => x.getAttribute("aria-pressed") === "true")) && await vis("#map .gm.pp .nm") > 0 && await vis("#map .gm.legchip") > 0, "'모두 기본값으로' turns everything back on");
await p.click("#visBtn");
// the earlier time / km switches carry over
await p.evaluate(() => { const v = JSON.parse(localStorage.getItem("omanGmaps.v1")); v.ui.noTm = true; v.ui.noKm = true; delete v.ui.hide; localStorage.setItem("omanGmaps.v1", JSON.stringify(v)); });
await p.reload(); await p.waitForTimeout(1200);
check(await vis("#map .gm.tick") === 0 && await p.evaluate(() => { const u = JSON.parse(localStorage.getItem("omanGmaps.v1")).ui; return !("noTm" in u) && ["ttm", "tkm", "ttn"].every(k => u.hide.includes(k)); }), "old time/km switches (both off) become 'no hourly marks'");
await p.click("#visBtn"); await p.click("#visReset"); await p.click("#visBtn");

// finer zoom: own +/- buttons and the wheel step by ui.zstep (½ by default); fractional zoom on
const Z = () => p.evaluate(() => window.__mockMap.z);
const setZ = z => p.evaluate(z => { window.__mockMap.z = z; }, z);
const wheel = (deltaY, ctrlKey = false) => p.evaluate(([d, c]) => document.querySelector("#map").dispatchEvent(new WheelEvent("wheel", { deltaY: d, ctrlKey: c, clientX: 300, clientY: 300, bubbles: true, cancelable: true })), [deltaY, ctrlKey]);
check(await p.evaluate(() => window.__mockMap.opts.isFractionalZoomEnabled === true && window.__mockMap.opts.zoomControl === false) && await vis("#map .zoomctl button") === 2, "fractional zoom on, own +/- buttons instead of Google's");
await setZ(8); await p.click('.zoomctl [data-z="1"]');
check(await Z() === 8.5, "+ zooms in by ½ by default");
await p.click('.zoomctl [data-z="-1"]'); await p.click('.zoomctl [data-z="-1"]');
check(await Z() === 7.5, "− zooms out by ½");
await setZ(7.37); await p.click('.zoomctl [data-z="1"]');
check(await Z() === 7.5, "after a pinch, + goes to the next ½ level");
await p.click("#visBtn"); await p.click('[data-zstep="0.25"]'); await p.click("#visBtn");
await p.click('.zoomctl [data-z="1"]');
check(await Z() === 7.75, "¼ step chosen in the 표시 panel");
const passed = await wheel(100);
check(await Z() === 7.5 && passed === false, "a wheel notch zooms out by the step, and Google never gets it");
await wheel(-100);
check(await Z() === 7.75, "wheel up zooms in by the step");
// the place under the mouse stays under the mouse
const under = () => p.evaluate(() => { const m = window.__mockMap, pr = m.getProjection(), r = m.el.getBoundingClientRect(), w = pr.fromLatLngToPoint(m.getCenter()), s = 2 ** m.z;
  const ll = pr.fromPointToLatLng({ x: w.x + (300 - r.left - r.width / 2) / s, y: w.y + (300 - r.top - r.height / 2) / s }); return [ll.lat(), ll.lng()]; });
const u0 = await under(); await wheel(-100); await wheel(-100); const u1 = await under();
check(Math.abs(u0[0] - u1[0]) < 1e-9 && Math.abs(u0[1] - u1[1]) < 1e-9 && await Z() === 8.25, "wheel zoom keeps the spot under the mouse in place");
await setZ(7.75);
await wheel(10, true);
check(Math.abs(await Z() - 7.65) < 1e-9, "trackpad pinch zooms smoothly");
await p.reload(); await p.waitForTimeout(1200);
check(await p.$eval('[data-zstep="0.25"]', e => e.getAttribute("aria-pressed")) === "true", "zoom step is remembered");
await p.click("#visBtn"); await p.click("#visReset"); await p.click("#visBtn");
check(await p.$eval('[data-zstep="0.5"]', e => e.getAttribute("aria-pressed")) === "true", "'모두 기본값으로' brings back the ½ step");

// view mode
await p.click("#viewBtn"); await p.waitForTimeout(200);
check(await p.$eval("#viewBtn", e => e.getAttribute("aria-pressed")) === "true" && await p.evaluate(() => document.body.classList.contains("viewonly")), "view button turns view mode on");
check(await vis(EDIT) === 0, "view mode hides every edit control (sheet and map bar)");
check((await pins()).length > 0 && (await pins()).every(d => !d), "view mode: plan pins can't be dragged");
check(await p.$eval("#planPad", e => e.disabled) && await p.$$eval("#whenUI select", e => e.length && e.every(x => x.disabled)), "view mode: plan % and departure date/time are locked");
check(!(await p.$('#planSel option[value="__new"]')), "view mode: no '새 빈 플랜' in the plan list");
let menu = await rightClickMap(p, 23.5, 57.0);
check(!menu.some(m => /추가|넣기|출발/.test(m)) && !!(await p.$(".ctxmenu .cx-note")), "view mode: right-click menu has no add items and says why");
await p.keyboard.press("Escape");
await p.evaluate(() => document.querySelector("#map .gm.pp").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
menu = await p.$$eval(".ctxmenu .cx-i", e => e.map(x => x.textContent.trim()));
check(menu.some(m => m.includes("플랜 목록에서 보기")) && !menu.some(m => /삭제|넣을 곳/.test(m)), "view mode: plan pin menu keeps only '목록에서 보기'");
await p.keyboard.press("Escape");
await p.evaluate(() => window.__mockMap.ls.click({ latLng: { lat: () => 23.06, lng: () => 57.66 }, placeId: "ChIJview", stop() {} }));
await p.waitForTimeout(150);
check(await p.evaluate(() => window.__iwOpen && !window.__iwc.querySelector(".planbox [data-ci]") && window.__iwc.textContent.includes("보기 모드")), "view mode: place card offers no 'add to plan'");
check((await nodes(p)).length === n0, "view mode: the plan did not change");
await p.reload(); await p.waitForTimeout(1200);
check(await p.evaluate(() => document.body.classList.contains("viewonly")) && await vis("[data-del]") === 0, "view mode is remembered after reload");
await p.goto(new URL("../index.html", import.meta.url).href + "#c6cd1"); await p.reload(); await p.waitForTimeout(1200);
check(await p.$$eval(".sheet [data-t24h], #coursePad", e => e.length && e.every(x => x.disabled)) && await vis("[data-load]") === 0, "view mode: built-in course times locked, 'load as plan' hidden");
check(await vis("#map .gm.named .lab .nm") > 0 && await vis("#map .gm.named .lab .tf") > 0 && await vis("#map .gm.chip .lab .tf") > 0, "course day view: stop and start/end labels have name + time parts");

// back to edit
await p.click("#editBtn"); await p.waitForTimeout(200);
check(!(await p.$eval("#coursePad", e => e.disabled)) && await vis("[data-load]") === 1 && await p.$$eval("#whenUI select", e => e.every(x => !x.disabled)), "edit button unlocks again");

// my location with a fake GPS
await p.evaluate(() => {
  const g = { cb: null, watches: 0, cleared: 0, watchPosition(ok, err) { g.watches++; g.cb = { ok, err }; return g.watches; }, clearWatch() { g.cleared++; g.cb = null; }, getCurrentPosition() {} };
  Object.defineProperty(navigator, "geolocation", { value: g, configurable: true });
  window.__geo = g;
  window.__fix = (lat, lng, acc, heading = null, speed = null) => g.cb.ok({ coords: { latitude: lat, longitude: lng, accuracy: acc, heading, speed } });
});
await p.click("#locBtn"); await p.waitForTimeout(50);
check(await p.evaluate(() => window.__geo.watches === 1) && await p.$eval("#locBtn", e => e.classList.contains("busy")), "location button starts watching (searching state)");
await p.evaluate(() => window.__fix(23.61234, 58.54321, 25, 90, 15)); await p.waitForTimeout(50);
check(!!(await p.$("#map .gm.me.moving")) && await p.evaluate(() => window.__circles.at(-1).o.radius === 25 && !!window.__circles.at(-1).o.map), "blue dot, heading cone and 25 m accuracy circle shown");
check(await p.$eval("#locBtn", e => e.getAttribute("aria-pressed") === "true" && !e.classList.contains("busy")) && await vis("#locOff") === 1, "button shows on, with an off button");
check(await p.evaluate(() => !Object.keys(localStorage).some(k => (localStorage.getItem(k) || "").includes("58.54321"))), "location is not stored");
await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
check(await p.evaluate(() => window.__geo.cleared === 1) && !!(await p.$("#map .gm.me.stale")), "hidden page pauses GPS, dot turns grey");
await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
check(await p.evaluate(() => window.__geo.watches === 2), "visible again resumes GPS");
await p.evaluate(() => window.__fix(23.61234, 58.54321, 25)); await p.waitForTimeout(50);
await p.evaluate(() => document.querySelector("#map .gm.me .dot").click()); await p.waitForTimeout(50);
menu = await p.$$eval(".ctxmenu .cx-i", e => e.map(x => (x.classList.contains("primary") ? "*" : "") + x.textContent.trim()));
check(await p.$eval(".ctxmenu .cx-h", e => e.textContent.includes("내 위치 · 오차 약 25m")) && menu[0].startsWith("*") && menu.some(m => m.includes("내 위치 끄기")), "tapping the dot opens a menu: add to plan, turn off");
await p.click(".ctxmenu .cx-i.primary"); await p.waitForTimeout(400);
check((await nodes(p)).length === n0 + 1, "'add' from the dot menu puts my location into the plan");
await p.click("#viewBtn"); await p.waitForTimeout(150);
await p.evaluate(() => document.querySelector("#map .gm.me .dot").click()); await p.waitForTimeout(50);
menu = await p.$$eval(".ctxmenu .cx-i", e => e.map(x => x.textContent.trim()));
check(menu.some(m => m.includes("내 위치 끄기")) && !menu.some(m => /추가|넣기|출발/.test(m)), "view mode: dot menu only offers turning it off");
await p.keyboard.press("Escape"); await p.click("#editBtn"); await p.waitForTimeout(150);
await p.click("#locOff"); await p.waitForTimeout(50);
check(!(await p.$("#map .gm.me")) && await p.evaluate(() => !window.__circles.at(-1).o.map && window.__geo.cb === null) && await p.$eval("#locBtn", e => e.getAttribute("aria-pressed")) === "false", "off button removes the dot and stops GPS");
await p.click("#locBtn"); await p.evaluate(() => window.__geo.cb.err({ code: 1 })); await p.waitForTimeout(50);
check(await vis("#locMsg") === 1 && (await p.textContent("#locMsg")).includes("권한") && await p.$eval("#locBtn", e => e.getAttribute("aria-pressed")) === "false", "permission denied: explains how to allow, turns off");
await finish();
